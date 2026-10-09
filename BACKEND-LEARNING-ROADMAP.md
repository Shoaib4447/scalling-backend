# Backend Engineering Roadmap: E-commerce Order System

This is a hands-on curriculum, not a list of tools to install all at once. We will build an e-commerce application in small, working increments and learn each backend concept at the point where it is needed. **First we expose and measure a real limitation in the simplest safe version. Then we introduce a technology only when we can explain which limitation it solves and can verify the improvement.**

## Project goal

Build a Next.js e-commerce application where a customer can place an order, get a prompt response, and have slower work continue reliably in the background. The system will grow to support local development, automated testing, containerization, horizontal scaling behind a reverse proxy, CI/CD, cloud deployment, orchestration, and production monitoring.

The central scenario is:

1. A customer clicks **Place order**.
2. The request reaches a reverse proxy (Nginx), which forwards it to one of several identical application instances.
3. The server authenticates the customer (**who are you?**), authorizes the action (**are you allowed to do this?**), validates the request, and recalculates prices from trusted product data.
4. In a PostgreSQL transaction, the server creates a pending order, reserves inventory, and records an outbox event.
5. The API responds promptly with the order ID and current status. It does not wait for email, fulfillment, or other slow work.
6. A background worker picks up the event and performs retryable work such as payment coordination, confirmation email, and fulfillment preparation.
7. The UI reads the order status. Payment-provider webhooks and worker results move the order through explicit states.
8. Metrics, logs, and traces let us answer: *How fast is checkout? Did anything crash? Is CPU, memory, or queue depth too high?*

**Important reliability rule:** a database transaction and a queue publish (to Redis or Kafka) do not happen as one atomic operation. We will learn the transactional outbox pattern so that a committed order cannot silently lose its queued work. Queues can deliver a job more than once, so workers must be idempotent.

## The full request lifecycle (the map we are building toward)

Each stage below is introduced by a phase of this roadmap. At the start of each phase, return to this map and find where the new piece fits.

```text
                    Customer's browser
                           │  HTTPS
                           ▼
                ┌──────────────────────┐
                │ DNS → CDN (static)   │  Phase 8, 12
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ Nginx reverse proxy  │  Phase 8: TLS, load balancing,
                │ / load balancer      │  rate limits, request size limits
                └───┬──────────┬───────┘
                    ▼          ▼
            ┌───────────┐ ┌───────────┐
            │ App inst. │ │ App inst. │   Phase 1, 7: stateless Next.js containers
            └─────┬─────┘ └─────┬─────┘
                  │  authenticate → authorize → validate   (Phase 3)
                  │
        ┌─────────┼──────────────────────────┐
        ▼         ▼                          ▼
   ┌────────┐ ┌──────────────┐        ┌──────────────┐
   │ Redis  │ │ PostgreSQL   │        │ Object store │
   │ cache, │ │ orders, stock│        │ images/files │
   │ limits │ │ outbox       │        └──────────────┘
   └────────┘ └──────┬───────┘
     Phase 6         │ Phase 2, 9
                     ▼
              ┌───────────────┐
              │ Outbox relay  │ Phase 4
              └──────┬────────┘
                     ▼
        ┌──────────────────────────┐
        │ Queue (BullMQ) or        │  Phase 4, then Phase 14
        │ event log (Kafka)        │
        └──────────┬───────────────┘
                   ▼
           ┌──────────────┐      ┌──────────────────────┐
           │ Workers      │ ───▶ │ Stripe, email, etc.  │ Phase 5
           └──────────────┘      └──────────────────────┘

Around everything:
  Docker images (Phase 7) → Kubernetes (Phase 13) → cloud infrastructure (Phase 12)
  CI/CD pipeline (Phase 10) builds, tests, and ships every change
  Prometheus + Grafana + logs + traces (Phase 11) watch every box above
```

## From the whiteboard notes to the roadmap

The handwritten notes that started this project map onto the phases as follows. Use this table to see where each idea will be built and measured.

| Note | Where it is covered | Clarification to keep in mind |
|---|---|---|
| Nginx: reverse proxy that sends each request to the right service | Phase 8 | Nginx also terminates TLS, balances load across instances, buffers slow clients, and enforces size and rate limits. In Kubernetes, an Ingress controller (often Nginx-based) does the same job. |
| Logged-in user = authentication (session, JWT, OAuth, OpenID Connect) | Phase 3 | These are not four interchangeable options. Sessions and JWTs are ways to *carry* a logged-in state. **OAuth 2.0 is about authorization**: it delegates access to an API. **OpenID Connect adds identity on top of OAuth** and is the protocol for "Sign in with Google." |
| "Verified in authentication": who and what | Phase 3 | *Who* is authentication. *What they may do* is **authorization**, a separate step with its own bugs (for example, user A reading user B's order). |
| Databases as long-term memory: Postgres, MySQL, SQL Server, Oracle, MongoDB | Phase 2, Phase 9 | The first four are relational (SQL). MongoDB is a document store. Orders, payments, and stock need transactions and constraints, so this project uses PostgreSQL. Phase 2 explains when a document store fits. |
| Check cache (Redis) | Phase 6 | A cache is short-term memory that can be lost or stale. It speeds up reads. It must never be the source of truth for stock or payments. Add a cache only after measuring a slow read. |
| Place order, run the task in a queue (Kafka) | Phase 4 (BullMQ), Phase 14 (Kafka) | A **job queue** (BullMQ, RabbitMQ, SQS) hands each task to one worker. **Kafka is a distributed event log**: many consumers can read the same events independently and replay them. We start with a job queue and move to Kafka only when we need its strengths. |
| Containerize the app so it runs on other systems and servers (Docker) | Phase 2 (dependencies), Phase 7 (the app itself) | A container packages the app with its runtime. It does not make the app stateless or scalable by itself. |
| Create, manage, and remove containers based on traffic (Kubernetes) | Phase 13 | Kubernetes schedules and heals containers. Scaling with traffic comes from a specific feature, the Horizontal Pod Autoscaler, driven by metrics you choose. |
| Run on cloud infrastructure | Phase 12 | We will learn the cloud building blocks: compute, managed databases, networking, IAM, and cost. We will define infrastructure as code. |
| Updating the app and adding features: CI/CD pipelines (GitHub Actions, GitLab CI, Azure DevOps, Jenkins) | Phase 10 | We use GitHub Actions, but the concepts (pipelines, stages, artifacts, secrets, environments, approvals) transfer to every tool listed. |
| Production monitoring: response time? service crash? high CPU or memory? Prometheus collects metrics, Grafana visualizes them | Phase 11 | Metrics are one of three signals. **Logs** explain individual events, and **traces** follow one request across services. Alerts turn dashboards into action. |

## Initial technology choices

We will start with a **modular monolith**: one deployable application with clear internal boundaries. It stays understandable while teaching the boundaries that could later be split into services (Phase 14).

| Area | Initial choice | What we will learn | Alternatives worth knowing |
|---|---|---|---|
| Web app and API | Next.js App Router, TypeScript, Node.js | HTTP, routing, server/client boundaries, runtime behavior | Express, Fastify, NestJS; Go, Java/Spring, .NET |
| Input schemas | Zod | Validation, parsing, safe API contracts | Valibot, JSON Schema, OpenAPI |
| Relational data | PostgreSQL | SQL, constraints, indexes, transactions, isolation | MySQL, SQL Server, Oracle; MongoDB (document) |
| Data access and migrations | Prisma | Schema modeling, generated types, migrations, query tradeoffs | Drizzle, Kysely, raw SQL |
| Cache, rate limits, sessions | Redis | Cache-aside, TTLs, invalidation, atomic counters | Memcached, Valkey, CDN caching |
| Background jobs | BullMQ on Redis | Queues, retries, backoff, idempotency, dead-letter handling | RabbitMQ, AWS SQS, pg-boss (Postgres-backed) |
| Event streaming (advanced) | Kafka (or Redpanda locally) | Partitions, consumer groups, offsets, replay, ordering | AWS Kinesis, NATS JetStream, Pulsar |
| Authentication | Auth.js or another established provider | Sessions, cookies, OAuth/OIDC, authorization | Clerk, Auth0, Keycloak, Cognito |
| Payments | Stripe test mode | Payment intents, webhook signatures, asynchronous payment state | Adyen, PayPal |
| Product images/files | S3-compatible object storage | Object storage, signed uploads, CDN delivery | MinIO locally, Cloudflare R2, GCS |
| Reverse proxy / load balancer | Nginx | TLS termination, upstreams, health checks, buffering, rate limiting | Caddy, HAProxy, Traefik, cloud load balancers |
| Containers | Docker, Docker Compose | Images, layers, multi-stage builds, networking, volumes | Podman |
| Orchestration | Kubernetes (kind or k3d locally) | Pods, Deployments, Services, Ingress, probes, autoscaling | Docker Swarm, AWS ECS, Google Cloud Run, Nomad |
| Infrastructure as code | Terraform or OpenTofu | Declarative infrastructure, plans, state, drift | Pulumi, AWS CDK, Bicep |
| Tests | Vitest, integration tests, Playwright | Unit, database, API, browser, and end-to-end testing | Jest, Cypress |
| Load testing | k6 (or autocannon) | Throughput, latency percentiles, saturation points | JMeter, Locust, Artillery |
| CI/CD | GitHub Actions | Checks, artifacts, deployment gates, secrets, rollback | GitLab CI, Azure DevOps, Jenkins, CircleCI |
| Observability | Pino logs, Prometheus, Grafana, OpenTelemetry | Metrics, dashboards, alerts, traces, structured logs | Datadog, New Relic, Grafana Cloud, Loki, Jaeger, Sentry |

These are candidate tools, not dependencies to install up front. We add each one when its phase shows the need. We choose concrete hosting providers when we reach Phase 12. Keep the application portable: use environment configuration, standard PostgreSQL/Redis interfaces, and containerized services, and keep provider-specific assumptions out of core business logic.

## Bottleneck-first learning rule

Before adding a library, service, or piece of infrastructure, we use this loop:

1. **Start with the simplest safe implementation.** Build the feature with the tools already in the project. Keep experiments local or in an isolated test environment.
2. **State the expected limit.** Predict what may fail or become too slow: response latency, concurrent stock updates, durability, duplicate work, security, maintainability, or operability. Write the prediction down *before* measuring.
3. **Make the limit observable.** Add a focused test, a small load or failure experiment, or a measurement. Record a baseline, such as p50/p95/p99 latency, requests per second, error rate, lost or duplicate jobs, or recovery time.
4. **Reproduce and diagnose.** Confirm the cause instead of guessing. A slow request might be waiting on email, for example, rather than needing a cache or a different database.
5. **Choose the smallest fitting solution.** Explain what the technology does, what it does not solve, and its operational cost. Add it only for this phase.
6. **Repeat the same check.** Compare before and after, test failure cases, and keep the technology only if it solves the demonstrated problem without breaking correctness.
7. **Teach the tradeoff.** Record why we added it, the alternatives considered, and the new failure modes it introduces, in an Architecture Decision Record (see [Learning artifacts](#learning-artifacts)).

"Push it to the bottleneck" means a controlled experiment. It does not mean exposing customers to data loss, security weaknesses, overselling, or an unstable production service. For safety-critical requirements, we demonstrate the risk with a local simulation or test instead of shipping a vulnerable implementation.

Examples we will work through:

| Limitation we demonstrate | Evidence to collect | Technology or design we may introduce | What we will verify |
|---|---|---|---|
| The request waits for slow email or fulfillment and times out | Endpoint latency with a deliberately slow local task | A queue and a separate worker (BullMQ/Redis) | Fast response, retry behavior, and no duplicate side effects |
| A process stops after accepting an order but before enqueueing work | Inject a crash between the database commit and the queue publish | Transactional outbox (a pattern, not a package) | Every committed order's work is eventually published |
| Concurrent checkouts oversell the last item | Run parallel order requests against limited stock | PostgreSQL transactions, constraints, and appropriate locking | Stock never goes below zero, and failed orders roll back |
| Data disappears on restart or cannot be queried reliably | Restart the app and run concurrent reads and writes | PostgreSQL plus a migration workflow | Durable data, constraints, and repeatable schema changes |
| Repeated or out-of-order payment callbacks corrupt order state | Replay webhook events in varied order | Idempotency keys, stored event IDs, guarded state transitions | Replays are safe, and the final state is consistent |
| The product catalog query dominates latency under load | k6 run against the catalog page, plus query timing | Indexes first, then Redis cache-aside if still needed | Lower p95 latency, with correct invalidation after a price change |
| One app instance saturates CPU under load | k6 ramp test while watching CPU and latency | More instances behind Nginx | Throughput scales, and sessions and orders work on any instance |
| Users are logged out or actions fail when requests hit different instances | Send consecutive requests through Nginx to two instances | Shared session store, shared encryption key, stateless app | Any instance can serve any request |
| We cannot tell which request or job failed in a multi-step flow | Trace a request through logs and a simulated worker failure | Structured logging, correlation IDs, metrics, tracing | The failure can be located from observable evidence |
| Workers fall behind during a traffic spike | Queue depth and age metrics during a burst test | Worker autoscaling based on queue lag | Queue drains within the target time, with no lost jobs |

Some choices are prerequisites for a safe application rather than performance optimizations. We will not implement real payments without signature verification, real accounts without authorization, or production orders without durable storage. When demonstrating a risky failure, we isolate it to tests or local development.

## Learning path

The phases are grouped into three parts. Each phase must leave the application runnable. Finish its outcome and checks before moving on.

- **Part 1, Build a correct backend (Phases 0–5):** HTTP, APIs, data, identity, asynchronous work, and external integrations.
- **Part 2, Make it fast and scalable (Phases 6–9):** caching, containers, reverse proxy and horizontal scaling, and database performance.
- **Part 3, Ship and operate it (Phases 10–14):** CI/CD, monitoring, cloud, Kubernetes, and event streaming.

Each phase uses the same structure:

- **Learn:** the concepts to understand.
- **Build:** what to add to the project.
- **Break it:** a controlled experiment that exposes the limit or failure mode.
- **Check your understanding:** questions to answer in your own words, without notes, before moving on. If you cannot answer one, revisit that part of the phase.
- **Outcome:** the verifiable result that ends the phase.

---

## Part 1: Build a correct backend

### Phase 0. Web, networking, and TypeScript foundations

**Learn**
- What happens between typing a URL and seeing a page: DNS resolution, TCP connection, TLS handshake, HTTP request and response, rendering.
- HTTP methods, status codes, headers, cookies, caching headers, and JSON. Idempotent versus non-idempotent methods.
- IP addresses, ports, localhost versus `0.0.0.0`, and what a process "listening on a port" means.
- JavaScript/TypeScript types, modules, async/await, promises, the Node.js event loop, and error handling.
- Frontend versus trusted server-side code. Never trust prices, roles, or inventory values sent by the browser.
- Git branches, commits, diffs, and code-review basics. Basic terminal and shell use.

**Build**
- Use browser DevTools (Network tab) and `curl -v` to inspect real requests to the running app.

**Break it**
- Block the event loop with a synchronous loop inside a request handler. Then send two concurrent requests and observe that the second waits.

**Check your understanding**
- Why does a slow synchronous function in Node.js slow down *other* users' requests?
- Which HTTP methods should be safe to retry, and why?
- What can a malicious user change in a request sent from their own browser?

**Outcome:** explain, step by step, what happens between clicking a button and the server returning a response.

### Phase 1. Application structure, API contracts, and the lab bench

**Learn**
- How to organize the Next.js app into routes, server-only business logic, data access, and shared schemas.
- API styles: REST resources, RPC-style actions, and when GraphQL or gRPC are used instead.
- Validation, stable response shapes, meaningful HTTP status codes, and an error format.
- Expected client errors (invalid input, unavailable stock) versus unexpected server errors.
- Pagination (offset versus cursor), filtering, API versioning, and backward-compatible changes.

**Build**
- A product catalog and a place-order endpoint, using in-memory data for now.
- **The lab bench**, which every later phase depends on:
  - Vitest with the first unit tests, run by an `npm test` script.
  - A structured JSON logger with a request ID on every log line.
  - A load-testing tool (k6 or autocannon) and a script to measure the order and catalog endpoints.
  - An `experiments/` folder where each experiment records its setup, prediction, and results.

**Break it**
- Send a negative quantity, a missing field, a huge body, and a client-supplied price. Confirm that each is rejected or ignored correctly.
- Record the first baseline: p50, p95, and p99 latency and requests per second for the catalog endpoint.

**Check your understanding**
- Why is the p99 latency often more important than the average?
- When should an endpoint return 400, 401, 403, 404, 409, 422, or 500?
- Why does in-memory storage break as soon as there are two server instances?

**Outcome:** a validated API creates a development-only order without trusting client totals. Tests and a recorded load-test baseline exist.

### Phase 2. PostgreSQL, data modeling, and transactions

**Learn**
- Relational versus document databases. Why orders, payments, and inventory favor relational constraints and transactions, and where a document store such as MongoDB fits (flexible, self-contained documents and fewer cross-entity invariants).
- How PostgreSQL, MySQL, SQL Server, and Oracle are similar and where they differ.
- ACID, transactions, isolation levels (read committed, repeatable read, serializable), and the anomalies each prevents.
- Foreign keys, unique and check constraints, indexes, and appropriate numeric types for money (integer minor units or `numeric`, never floating point).
- Migrations, and why schema changes must be safe to deploy.
- Row locking (`SELECT … FOR UPDATE`), optimistic concurrency, and atomic conditional updates.

**Build**
- Docker Compose with PostgreSQL for local development, including a named volume, a health check, and a pinned image version. (Phase 7 will containerize the app itself.)
- An `.env.example` with variable names and safe placeholders only. Never commit real `.env` files.
- Models for users, products, inventory, orders, order items, payments, and outbox events.
- A transaction for order creation and inventory reservation.
- Order-item price and name snapshots, so later catalog edits do not rewrite history.

**Break it**
- Run 50 parallel orders against a product with stock of 1, first *without* a transaction or lock, and record the oversell. Then fix it and repeat.
- Kill the database mid-transaction and confirm that no partial order remains.

**Check your understanding**
- Two customers buy the last item at the same moment. Walk through what happens with and without a row lock.
- Why is a floating-point `price` column a bug?
- What would you lose by storing orders in MongoDB, and what would you gain?

**Outcome:** concurrent order requests cannot oversell inventory, and a failed order leaves no partial records.

### Phase 3. Authentication, authorization, and security

**Learn**
- **Authentication** (who you are) versus **authorization** (what you may do).
- Ways to carry a logged-in state:
  - **Server-side sessions:** a random session ID in an `HttpOnly` cookie, with the session data in a database or Redis. Easy to revoke, but requires a lookup.
  - **JWTs:** signed, self-contained tokens. No lookup is needed, but revocation is hard. Short expiry plus refresh tokens is the usual compromise. Signed is not encrypted: anyone can read the contents.
- **OAuth 2.0:** delegated authorization. A user lets an app access an API on their behalf using access tokens and scopes. The flow for web apps is authorization code with PKCE.
- **OpenID Connect (OIDC):** an identity layer on OAuth 2.0 that adds an ID token. This is how "Sign in with Google" works.
- Authorization models: ownership checks, role-based access control (RBAC), and attribute- or policy-based rules.
- Password hashing (argon2/bcrypt), cookie flags (`HttpOnly`, `Secure`, `SameSite`), CSRF, CORS, SSRF, injection, and the OWASP Top 10.

**Build**
- Sign-in through an established authentication library or provider, with at least one OIDC provider and secure session handling. Do not write your own crypto or password storage.
- Ownership checks: customers can read only their own orders. Administrative actions require an explicit permission.
- Input validation on every endpoint, rate limiting on sign-in and checkout, and security headers.
- Least-privilege database credentials. Secrets stay out of source control and logs.

**Break it**
- As user A, request user B's order by ID (an IDOR attack). Write a test that proves it returns 403 or 404.
- Decode a JWT at a debugging tool, observe that the payload is readable, and change one character to observe that the signature check fails.
- Send a request from another origin and observe what CORS does and does not protect.

**Check your understanding**
- Why is OAuth 2.0 alone not a login protocol?
- A user's account is compromised. How do you log them out everywhere with sessions, and with JWTs?
- Why must authorization checks run on the server even if the UI hides the button?

**Outcome:** users can safely create and view only the orders they are allowed to access.

### Phase 4. Fast order response and background processing

**Learn**
- Synchronous versus asynchronous work, and why the request path should only validate, authorize, write durable state, and return.
- Order states and legal transitions (for example `pending`, `payment_pending`, `paid`, `fulfillment_pending`, `fulfilled`, `failed`, `cancelled`).
- The transactional outbox pattern.
- Delivery guarantees: at-most-once, at-least-once, and why "exactly once" must not be assumed.
- Idempotency, retries with exponential backoff and jitter, timeouts, concurrency limits, and dead-letter queues.
- Job queues compared with event logs (preparing for Phase 14).

**Build**
- Add Redis to Docker Compose.
- An outbox row in the same PostgreSQL transaction as the order.
- An outbox relay that claims unpublished events safely (for example with `FOR UPDATE SKIP LOCKED`), publishes them to BullMQ, and marks them published only after enqueueing succeeds.
- A worker as a separate process or command. Do not rely on a serverless request continuing after its response.
- Idempotent jobs, using a stable event/job key and database uniqueness or conditional state transitions.
- An order-status read endpoint with authorization. Use polling first, and consider server-sent events or WebSockets only if the product needs live updates.

**Break it**
- Add a 5-second fake email step to the request, measure latency, then move it to the worker and measure again.
- Kill the process between commit and publish, and confirm that the outbox recovers the work.
- Deliver the same job twice and confirm that only one email is "sent."
- Make a job always fail and confirm that it lands in the failed-job review path after bounded retries.

**Check your understanding**
- Why is "write to the database, then publish to Redis" in one function not safe?
- What makes a job idempotent? Give an example of a non-idempotent job and fix it.
- Why add jitter to retry backoff?

**Outcome:** order creation returns without waiting for email or fulfillment, and failures are retried without duplicate charges or notifications.

### Phase 5. Payments and external integrations

**Learn**
- Payment intents, authorization and capture, refunds, idempotency keys, and reconciliation.
- Webhook signatures, duplicate and out-of-order delivery, and fast acknowledgment.
- Timeouts, retry policies, circuit breakers, bulkheads, and the limits of distributed transactions (the saga pattern as an alternative).

**Build**
- Create payment operations on the server. Never accept a browser-provided amount as authoritative.
- Verify webhook signatures, store webhook event IDs, and move slow follow-up work to the queue.
- Store only payment-provider identifiers and the minimum data needed. Never store card details.

**Break it**
- Replay the same webhook three times and in reverse order.
- Make the provider time out (with a local stub) and confirm that the circuit breaker opens and recovers.

**Check your understanding**
- Why can't one database transaction cover both "charge the card" and "mark the order paid"?
- What should happen if a payment succeeds but the order was already cancelled?

**Outcome:** order and payment state remain consistent when a webhook is delayed or duplicated, or when the provider is temporarily unavailable.

---

## Part 2: Make it fast and scalable

### Phase 6. Caching with Redis

**Learn**
- Where caches live: browser, CDN, reverse proxy, application memory, Redis, and the database's own buffer cache.
- Cache-aside, read-through, and write-through. TTLs, invalidation, and the rule that a cache can be lost or stale at any time.
- Cache stampedes (thundering herd), hot keys, and negative caching.
- What **not** to cache as truth: stock levels at checkout, payment state, and authorization decisions.
- Other Redis uses: rate-limit counters, session storage, distributed locks (and their limits).
- **Framework caching:** this project enables Next.js `cacheComponents`. Learn how Next.js caches before measuring, so that framework caching does not hide or distort application-level results. Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.

**Build**
- Measure catalog latency under load first (from your Phase 1 and 2 baselines). Check the query plan and indexes *before* adding a cache.
- If the read is still too slow, add cache-aside for product listings with a TTL and explicit invalidation on product updates.
- Cache hit-ratio logging or metrics.

**Break it**
- Change a price and confirm that the cache is invalidated and checkout still uses the database price.
- Stop Redis and confirm that the site degrades to slower database reads instead of failing.
- Expire a hot key under load and observe the stampede, then mitigate it.

**Check your understanding**
- Why must checkout still read stock from PostgreSQL even when a cache exists?
- What is the difference between a TTL and invalidation, and when do you need both?

**Outcome:** catalog p95 latency improves measurably, prices stay correct after updates, and the app survives a Redis outage.

### Phase 7. Containerizing the application (Docker)

**Learn**
- Images, layers, the build cache, containers, volumes, networks, and the difference between an image and a running container.
- Multi-stage builds, minimal base images, running as a non-root user, and `.dockerignore`.
- Next.js `output: "standalone"` for small production images.
- Build-time versus runtime configuration: one image promoted through every environment with different environment variables.
- Graceful shutdown: handling `SIGTERM`, finishing in-flight requests, and draining workers.

**Build**
- A production Dockerfile for the web app and one for the worker (or one image with two commands).
- A Docker Compose profile that runs the full stack: web, worker, outbox relay, PostgreSQL, and Redis.
- Startup validation of required environment variables, and health and readiness endpoints.

**Break it**
- Compare image size and build time before and after a multi-stage build and a correct `.dockerignore`.
- Send `docker stop` during an in-flight order and confirm that it either completes or is safely retried.

**Check your understanding**
- Why should the same image run in staging and production?
- What is lost when a container restarts, and where must that data live instead?

**Outcome:** another developer can run the entire system with one command, and the production image is small, non-root, and configurable at runtime.

### Phase 8. Reverse proxy, load balancing, and horizontal scaling (Nginx)

**Learn**
- Forward proxy versus reverse proxy. Load-balancing algorithms (round robin, least connections, IP hash), and why sticky sessions are a workaround, not a design.
- Vertical scaling (a bigger machine) versus horizontal scaling (more instances), and why horizontal scaling requires **stateless** application instances.
- TLS termination, HTTP/2, `X-Forwarded-For` and `X-Forwarded-Proto`, and trusted-proxy configuration.
- Request buffering, body-size limits, timeouts, gzip/brotli, static-asset caching, and edge rate limiting.
- Proxying long-lived connections (WebSockets, server-sent events).
- What Next.js needs when running multiple instances: a shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, a consistent `deploymentId`, a shared or coordinated cache, and protection against version skew during rolling deploys. Read `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`.
- CDNs: what they cache, cache keys, and `Cache-Control` headers.

**Build**
- Nginx in Docker Compose in front of 2–3 web instances, with upstream health checks, timeouts, request-size limits, and edge rate limiting on sign-in and checkout.
- Correct client-IP logging and rate limiting through trusted proxy headers.
- Local HTTPS for Nginx (for example with a locally trusted development certificate).

**Break it**
- Run a k6 ramp test against one instance until latency degrades. Then add instances and find where throughput stops scaling. Identify what saturates next (often the database or connection pool).
- Kill one instance during a load test and observe failover and error rate.
- Leave the encryption key unset with two instances and reproduce the "Failed to find Server Action" error, then fix it.

**Check your understanding**
- Why does adding app instances eventually stop helping?
- Which piece of state did you have to move out of the app process to make scaling work?
- Why must the app trust `X-Forwarded-For` only from the proxy?

**Outcome:** the app runs as several interchangeable instances behind Nginx, survives the loss of one, and has a measured scaling curve.

### Phase 9. Database performance and scaling

**Learn**
- `EXPLAIN ANALYZE`, query plans, index types, composite and partial indexes, and N+1 queries.
- Connection limits, connection pooling (Prisma pool settings, PgBouncer), and why serverless and many instances can exhaust connections.
- Read replicas and replication lag ("I placed an order but can't see it").
- Partitioning, archival, and sharding concepts. The CAP theorem and consistency models, at a conceptual level.
- Search: PostgreSQL full-text search first, then dedicated engines (OpenSearch, Meilisearch) if search becomes a demonstrated need.

**Build**
- Seed a realistic data volume (for example 100,000 products and 1 million orders) and profile the slowest queries.
- Indexes and query fixes driven by evidence, and a connection-pool configuration sized to the instance count.

**Break it**
- Scale the app to many instances until PostgreSQL rejects connections, then fix it with pooling.
- Simulate replica lag and find which reads must go to the primary.

**Check your understanding**
- Why can an index make writes slower?
- After placing an order, which reads must go to the primary and why?

**Outcome:** the slowest queries are measured and fixed, and the database survives the instance count from Phase 8 without connection exhaustion.

---

## Part 3: Ship and operate it

### Phase 10. Testing strategy, quality gates, and CI/CD

Testing starts in Phase 1 and grows with every phase. This phase connects it to automated delivery.

**Learn**
- The test pyramid: unit tests for domain rules and state transitions, integration tests against a real PostgreSQL and Redis, contract tests, and end-to-end tests with Playwright.
- Test data setup and isolation, deterministic clocks, and where to mock.
- Continuous integration versus continuous delivery versus continuous deployment.
- Pipeline concepts shared by GitHub Actions, GitLab CI, Azure DevOps, and Jenkins: triggers, jobs, stages, runners/agents, caches, artifacts, secrets, environments, and approvals.
- Deployment strategies: rolling, blue/green, and canary. Feature flags. Rollback limits when migrations are involved.
- Database migrations as a controlled release step, and expand/migrate/contract for zero-downtime schema changes.
- Supply-chain basics: lockfiles, dependency scanning, and pinned action versions.

**Build**
- A GitHub Actions pipeline on pull requests: install from the lockfile, lint, type-check, run unit and integration tests (with PostgreSQL and Redis service containers), build, and run end-to-end tests.
- Build the Docker image once, tag it with the commit SHA, push it to a registry, and promote the same image to staging and production.
- Protected branches, required checks, environment-scoped secrets, and a manual approval gate for production.

**Break it**
- Introduce an oversell bug in a pull request and confirm that CI blocks the merge.
- Practice a rollback, and a migration that cannot be rolled back, in staging.

**Check your understanding**
- Why should you build the image once instead of once per environment?
- How do you remove a database column without downtime?

**Outcome:** CI catches an order-correctness regression before deployment, and every deploy is traceable to a commit.

### Phase 11. Observability and monitoring (Prometheus, Grafana, OpenTelemetry)

Run the full monitoring stack locally in Docker Compose first, so you can learn it before production depends on it.

**Learn**
- The three signals: **metrics** (numbers over time), **logs** (individual events), and **traces** (one request across components).
- Prometheus: the pull/scrape model, counters, gauges, histograms, labels, cardinality, and PromQL basics.
- Grafana: dashboards, panels, and alerting.
- OpenTelemetry: one standard for emitting traces, metrics, and logs.
- Methods that answer the questions from the notes:
  - **RED** for services: Rate, Errors, Duration ("what is the app's response time?").
  - **USE** for resources: Utilization, Saturation, Errors ("is CPU or memory usage high?").
  - Liveness and up/down checks ("did a service crash?").
- SLIs, SLOs, error budgets, and alerts on symptoms users feel rather than every internal metric.

**Build**
- Prometheus metrics from the web app, worker, and outbox relay: request latency histograms, error rates, queue depth and job age, worker failures, database pool usage, and payment outcomes.
- Exporters for PostgreSQL, Redis, Nginx, and container CPU/memory.
- Grafana dashboards: a checkout overview and a queue/worker view.
- OpenTelemetry tracing across API → database → outbox → queue → worker → payment provider.
- Error reporting (for example Sentry) and alerts for high checkout error rate, slow p95, growing queue age, and a crashed worker.
- Logs that include request, order, and job IDs, and never credentials or sensitive payment data.

**Break it**
- Stop the worker during a load test. Confirm that an alert fires, find the cause from the dashboard and traces alone, then recover without losing orders.
- Add a label with user IDs to a metric and observe what high cardinality does to Prometheus.

**Check your understanding**
- Why alert on p95 checkout latency instead of on CPU?
- When do you reach for logs, metrics, or traces?

**Outcome:** a stuck queue or degraded checkout is detected by an alert, and the failing component can be located from dashboards and traces.

### Phase 12. Cloud deployment and infrastructure as code

**Learn**
- Cloud building blocks: compute options (virtual machines, managed containers, serverless functions), managed PostgreSQL and Redis, object storage, load balancers, DNS, and CDNs.
- Networking: VPCs, public and private subnets, security groups and firewalls, and keeping databases off the public internet.
- Identity and access management (IAM), least privilege, workload identity, and secret managers.
- Infrastructure as code with Terraform or OpenTofu: providers, resources, plans, state, modules, and drift.
- Cost awareness: what drives the bill, budgets, and alerts. Shut down experiments.
- Backups, point-in-time recovery, restore drills, multiple availability zones, and disaster recovery (RPO/RTO).

**Build**
- Choose a provider. Start with the simplest platform that runs containers (a managed container service or a single VM) before Kubernetes.
- Define staging infrastructure in code: network, managed PostgreSQL, managed Redis, container service, load balancer/TLS, object storage, and secrets.
- Deploy the CI-built image from Phase 10, run migrations as a release step, and connect monitoring from Phase 11.
- Perform and document a restore from backup.

**Break it**
- Destroy and recreate the staging environment entirely from code.
- Restore the database to a point in time and measure how long it takes (your actual RTO).

**Check your understanding**
- Why must the database not have a public IP address?
- What is the difference between a backup and a tested restore?

**Outcome:** staging is reproducible from code, deploys come from CI, and the team has a tested recovery path.

### Phase 13. Kubernetes: orchestration and autoscaling

Kubernetes adds real operational cost. Use it here to learn the concepts. In a real project, justify it with the bottleneck-first rule against simpler managed container platforms.

**Learn**
- Cluster architecture: control plane, nodes, kubelet, and the scheduler.
- Pods, Deployments, ReplicaSets, Services, Ingress (often the Nginx Ingress Controller, connecting back to Phase 8), ConfigMaps, Secrets, and Namespaces.
- Liveness, readiness, and startup probes; resource requests and limits; and graceful termination.
- Rolling updates and rollbacks, and PodDisruptionBudgets.
- Autoscaling: the Horizontal Pod Autoscaler on CPU, and event-driven autoscaling (KEDA) on queue length for workers. Cluster autoscaling for nodes.
- Packaging with Helm or Kustomize, and GitOps (Argo CD or Flux) as a deployment model.

**Build**
- A local cluster with kind or k3d.
- Manifests for web, worker, and outbox relay, with probes, resource limits, an Ingress, and configuration from ConfigMaps and Secrets. Keep PostgreSQL managed or outside the cluster at first.
- An HPA for web and a queue-based autoscaler for workers.

**Break it**
- Delete pods during a load test and watch self-healing.
- Ship an image with a failing readiness check and confirm that the rolling update stops instead of taking the site down.
- Drive a burst of orders and watch workers scale out on queue length, then scale back in.

**Check your understanding**
- What is the difference between a liveness probe and a readiness probe, and what goes wrong if you confuse them?
- Why scale workers on queue lag rather than CPU?

**Outcome:** the system self-heals, rolls out safely, and scales web and workers automatically on the right signals.

### Phase 14. Event streaming with Kafka and service boundaries (advanced, optional)

**Learn**
- Kafka fundamentals: topics, partitions, offsets, consumer groups, retention, and replay.
- Ordering guarantees per partition key (for example, all events for one order ID go to one partition).
- Delivery semantics, idempotent producers, and consumer offset commits.
- Event-driven architecture: event notification versus event-carried state, schemas and schema evolution, and the outbox → Kafka pattern (for example with Debezium change data capture).
- When to split a modular monolith into services, and the costs: network failures, distributed tracing, service-to-service authentication, and data ownership. Sagas for multi-service workflows.

**Build**
- Kafka (or Redpanda) locally. Publish order events from the outbox.
- Two independent consumers of the same events, for example notifications and an analytics read model, to show what a job queue cannot do easily.
- Optionally, extract the notification module into its own service with its own deployment.

**Break it**
- Stop a consumer, keep producing, then restart it and confirm that it catches up from its offset.
- Rebuild the analytics read model by replaying the topic from the beginning.

**Check your understanding**
- When would you choose BullMQ over Kafka for this system, and when the reverse?
- What new failure modes did extracting a service introduce?

**Outcome:** you can explain, with working evidence, the difference between a job queue and an event log, and the cost of splitting a service out.

### Capstone: production game day

Run a planned failure exercise against staging with load running:

1. Kill a web instance, the worker, and Redis, one at a time.
2. Make the payment provider slow, then unavailable.
3. Run a schema migration during traffic.
4. Restore the database from backup.

For each one, use the dashboards and alerts to detect the problem, follow the runbook to recover, and confirm that no order was lost or duplicated. Write a blameless post-incident review.

---

## The order request in more detail

```text
Browser
  -> HTTPS request with authenticated session and cart item IDs/quantities
  -> Nginx: TLS termination, rate limit, forward to a healthy app instance
  -> Next.js server: authenticate, authorize, validate input
  -> (catalog reads may use the Redis cache; checkout never trusts cached stock or price)
  -> PostgreSQL transaction:
       verify current product prices and stock
       reserve stock
       create order + immutable order-item snapshots
       insert outbox event
  -> commit
  <- prompt response: order ID + current status

Outbox relay
  -> claims unpublished events safely
  -> enqueues durable BullMQ jobs in Redis (or publishes to Kafka in Phase 14)
  -> marks events published

Worker
  -> processes idempotently
  -> coordinates payment/email/fulfillment
  -> records outcome and advances order state

Browser
  -> authorized status request (polling initially)
  <- current order state

Throughout
  -> every hop emits logs with the request/order/job ID, metrics, and trace spans
```

The initial response must reflect the work the server has actually accepted. If payment is still pending, say so. Do not tell the customer an order is paid or fulfilled before that is confirmed. We will choose between `201 Created` and `202 Accepted` based on the exact contract when implementing the endpoint, and document that contract in tests.

## Production environment checklist

- Separate credentials and resources for local, preview/staging, and production.
- TLS for public traffic and managed-service connections; secure cookies and trusted proxy configuration.
- Reverse proxy or load balancer with health checks, timeouts, request-size limits, and rate limiting.
- Stateless application instances, with a shared Next.js encryption key and deployment ID across instances.
- A secret manager or protected CI/CD environment variables, with rotation and least privilege.
- Managed PostgreSQL with backups, tested restores, a migration strategy, and connection pooling.
- Managed Redis with persistence and monitoring appropriate to the queue's delivery guarantees.
- Independently deployable and scalable web, worker, and outbox-relay processes, with health checks and graceful shutdown.
- Infrastructure defined as code and reproducible.
- Payment-provider production keys and webhook endpoints configured only in production.
- Object-storage access policies, upload size and type validation, and lifecycle rules.
- Logs, metrics, traces, dashboards, alerts, error reporting, and an incident and rollback runbook.
- Privacy-conscious data retention, deletion and export workflows where applicable, and auditability.
- Budget alerts and cost visibility.

## How we will work through this

For each phase, we will:

1. State the user or operational problem and predict the current implementation's limit.
2. Build or measure a safe baseline and reproduce the limitation with a focused experiment.
3. Learn the concept and decide whether a technology is actually needed to address it.
4. Implement one vertical slice (API, persistence, tests, and any UI needed), adding only the required dependency.
5. Repeat the experiment and compare results; test failure modes and explain the production tradeoffs.
6. Answer the phase's *Check your understanding* questions in writing.
7. Run the smallest relevant checks, then the full CI checks at integration milestones.

Do not add every listed technology on day one. We begin with the app shell and let a demonstrated requirement or bottleneck motivate each addition. We do not add a tool because it is popular or because it appears later in this roadmap.

## Learning artifacts

Knowledge sticks when you write it down. Keep these in the repository alongside the code:

- [`BACKEND-CONCEPTS.md`](BACKEND-CONCEPTS.md): the living glossary of backend vocabulary. Each concept is added when it first comes up and marked 🌱 introduced → 🔧 built → ✅ mastered as the work progresses.
- `docs/adr/NNNN-title.md`: one **Architecture Decision Record** per technology or design choice. Record the context, the evidence (link the experiment), the decision, the alternatives considered, and the consequences and new failure modes.
- `experiments/NNNN-title/`: the script, the prediction made *before* running it, the raw results, and a short conclusion. Reuse the same script for the before/after comparison.
- `docs/runbooks/`: from Phase 4 onward, how to diagnose and recover from each failure you have reproduced (stuck queue, failed webhooks, database restore).
- `docs/journal.md`: a short entry per session covering what you learned, what surprised you, and what remains unclear.
- Your answers to each phase's *Check your understanding* questions.

## Progress tracker

- [ ] Phase 0: Web, networking, and TypeScript foundations
- [ ] Phase 1: API contracts and the lab bench (tests, logging, load testing)
- [ ] Phase 2: PostgreSQL, data modeling, and transactions
- [ ] Phase 3: Authentication, authorization, and security
- [ ] Phase 4: Fast response and background processing (outbox, BullMQ)
- [ ] Phase 5: Payments and external integrations
- [ ] Phase 6: Caching with Redis
- [ ] Phase 7: Containerizing the application
- [ ] Phase 8: Nginx, load balancing, and horizontal scaling
- [ ] Phase 9: Database performance and scaling
- [ ] Phase 10: Testing strategy, quality gates, and CI/CD
- [ ] Phase 11: Observability and monitoring
- [ ] Phase 12: Cloud deployment and infrastructure as code
- [ ] Phase 13: Kubernetes orchestration and autoscaling
- [ ] Phase 14: Event streaming with Kafka (optional)
- [ ] Capstone: production game day

## Repository layout

The Next.js application lives in `storefront/`. As the system grows it needs sibling folders for the worker, infrastructure, and documentation, and CI workflows must live at the repository root (`.github/workflows/`). Make the workspace root the Git repository and use this layout:

```text
scalling-backend/
├── .github/workflows/        CI/CD pipelines (Phase 10)
├── storefront/               Next.js web app and API
├── worker/                   background worker and outbox relay (Phase 4); may share code with storefront
├── infra/
│   ├── docker/               Dockerfiles, Compose files, Nginx config (Phases 2, 7, 8)
│   ├── monitoring/           Prometheus and Grafana config (Phase 11)
│   ├── terraform/            cloud infrastructure (Phase 12)
│   └── k8s/                  Kubernetes manifests or Helm charts (Phase 13)
├── experiments/              load and failure experiments with results
├── docs/
│   ├── adr/                  architecture decision records
│   ├── runbooks/             operational recovery guides
│   └── journal.md
├── BACKEND-CONCEPTS.md       living glossary of concepts learned
└── BACKEND-LEARNING-ROADMAP.md
```

## Initial setup and useful commands

The project uses npm unless it later adopts another package manager. From the workspace root in PowerShell:

```powershell
Set-Location .\storefront
npm install
npm run dev
npm run lint
npm run build
```

Database, worker, test, and load-test scripts will be added as their phases are implemented. Keep the package lockfile committed so that local and CI installs resolve the same dependency versions.

This project uses Next.js 16, which renamed Middleware to **Proxy** (`proxy.ts`) and changed several conventions. Before writing framework code, check the bundled docs in `storefront/node_modules/next/dist/docs/` rather than older tutorials. A Next.js `proxy.ts` is not a substitute for Nginx: it runs inside the app, and the bundled docs advise against using it as a full session-management or authorization solution.
