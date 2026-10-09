# Backend Concepts Glossary

A living vocabulary of the backend concepts we have met while building this project. It is updated as we work: a concept is added when it first comes up, and its status moves forward when we build it and when we can explain it without notes.

The [roadmap](BACKEND-LEARNING-ROADMAP.md) says what we will learn. This file records what we *have* learned.

## How to read this file

**Status**

| Mark | Meaning |
|---|---|
| 🌱 Introduced | Discussed and understood in theory, but not yet built in the app |
| 🔧 Built | Implemented or experimented with in this codebase |
| ✅ Mastered | Built, tested with a "Break it" experiment, and explainable from memory |

**Every entry has**
- **In one sentence:** the plain-language definition.
- **Analogy:** a real-world picture to anchor it.
- **In our app:** where it appears (or will appear) in this project.
- **Watch out:** the common mistake or misconception.
- **Related:** linked concepts.

To quiz yourself, cover everything below a heading and explain the concept out loud, then check.

---

## Commonly confused pairs

The fastest way to sound like (and think like) a backend engineer is to keep these apart.

| This | is not the same as | The difference |
|---|---|---|
| [Authentication](#authentication) | [Authorization](#authorization) | *Who are you?* versus *What are you allowed to do?* |
| [OAuth 2.0](#oauth-20) | [OpenID Connect](#openid-connect-oidc) | Granting an app access to an API versus logging a user in |
| [Session](#session-server-side) | [JWT](#jwt-json-web-token) | State stored on the server versus state carried inside a signed token |
| [Job queue](#job-queue) | [Event log](#event-log-kafka) | One task, one worker, then gone versus a stored history that many readers can replay |
| [Cache](#cache) | [Source of truth](#source-of-truth) | A fast copy that may be stale or lost versus the authoritative record |
| [Vertical scaling](#vertical-vs-horizontal-scaling) | [Horizontal scaling](#vertical-vs-horizontal-scaling) | A bigger machine versus more machines |
| [Container](#container-and-image) | [Kubernetes](#kubernetes) | A packaged app versus the system that runs and heals many packaged apps |
| [Reverse proxy](#reverse-proxy) | [Next.js Proxy](#nextjs-proxy-vs-nginx) | A separate server at the edge versus code running inside the app |
| [Metrics](#metrics-logs-and-traces) | [Logs](#metrics-logs-and-traces) | Numbers over time versus a record of individual events |

---

## Architecture and approach

### Modular monolith
**Status:** 🌱 Introduced · **Roadmap:** Overview, Phase 14

- **In one sentence:** one deployable application whose code is divided into modules with clear boundaries (orders, payments, catalog) that do not reach into each other's internals.
- **Analogy:** one building with separate, clearly labeled departments, instead of separate buildings connected by roads.
- **In our app:** the whole system starts as the single `storefront/` app plus a worker process.
- **Watch out:** "monolith" is not a bad word. Microservices add network failures, deployment complexity, and distributed debugging. Split a module out only when there is a demonstrated reason.
- **Related:** [Stateless instance](#stateless-instance)

### Bottleneck-first (measure before you optimize)
**Status:** 🌱 Introduced · **Roadmap:** Bottleneck-first learning rule

- **In one sentence:** build the simplest safe version, measure where it actually fails, then add only the technology that fixes the measured problem.
- **Analogy:** a doctor runs tests before prescribing medicine.
- **In our app:** every phase has a "Break it" experiment with a recorded baseline before and after a change.
- **Watch out:** adding Redis, Kafka, or Kubernetes "because big companies use it" adds cost and new failure modes without proven benefit.
- **Related:** [Latency percentiles](#latency-percentiles-p50-p95-p99)

---

## HTTP, networking, and the edge

### Reverse proxy
**Status:** 🌱 Introduced · **Roadmap:** Phase 8

- **In one sentence:** a server that sits in front of your application servers, receives every client request, and forwards it to the right backend.
- **Analogy:** a hotel receptionist: guests never walk into the back office; the receptionist routes each request to the right staff member.
- **In our app:** Nginx will sit in front of several Next.js instances.
- **Watch out:** a *forward* proxy acts on behalf of clients (for example a corporate proxy); a *reverse* proxy acts on behalf of servers.
- **Related:** [Load balancer](#load-balancer), [TLS termination](#tls-termination), [Next.js Proxy](#nextjs-proxy-vs-nginx)

### Load balancer
**Status:** 🌱 Introduced · **Roadmap:** Phase 8

- **In one sentence:** spreads incoming requests across several identical servers and stops sending traffic to unhealthy ones.
- **Analogy:** a supermarket staff member directing shoppers to the shortest open checkout.
- **In our app:** Nginx will balance between 2–3 app instances; later, a Kubernetes Ingress or cloud load balancer does the same.
- **Watch out:** "sticky sessions" (always sending a user to the same server) hide a stateful app instead of fixing it.
- **Related:** [Horizontal scaling](#vertical-vs-horizontal-scaling), [Stateless instance](#stateless-instance)

### TLS termination
**Status:** 🌱 Introduced · **Roadmap:** Phase 8

- **In one sentence:** the point where encrypted HTTPS traffic is decrypted, usually at the reverse proxy, so the app servers behind it do not each manage certificates.
- **Analogy:** a secure mailroom that opens sealed envelopes and passes the contents to internal departments.
- **In our app:** Nginx will hold the certificate and forward requests to the app.
- **Watch out:** after termination, the app sees the proxy as the client. It must read the real client IP and protocol from `X-Forwarded-For` / `X-Forwarded-Proto`, and trust those headers only from the proxy.
- **Related:** [Reverse proxy](#reverse-proxy)

### Next.js Proxy vs Nginx
**Status:** 🌱 Introduced · **Roadmap:** Initial setup

- **In one sentence:** Next.js 16 renamed Middleware to "Proxy" (`proxy.ts`); it is code that runs *inside* the app before a route, not a separate reverse-proxy server.
- **Analogy:** a security guard at the department door (Next.js Proxy) versus the receptionist at the building entrance (Nginx).
- **In our app:** use `proxy.ts` for light checks such as redirects; use Nginx for TLS, load balancing, and edge rate limiting.
- **Watch out:** the Next.js docs say not to rely on `proxy.ts` as a full session-management or authorization solution. Check authorization in the code that reads or changes data.
- **Related:** [Reverse proxy](#reverse-proxy), [Authorization](#authorization)

---

## Identity and security

### Authentication
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** proving *who* the user is.
- **Analogy:** showing your passport at the airport.
- **In our app:** sign-in through an established library or OIDC provider, then a session cookie on each request.
- **Watch out:** a logged-in user is not automatically allowed to do everything. That is a separate check.
- **Related:** [Authorization](#authorization), [Session](#session-server-side), [JWT](#jwt-json-web-token), [OpenID Connect](#openid-connect-oidc)

### Authorization
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** deciding *what* an authenticated user is allowed to do.
- **Analogy:** your boarding pass decides which plane you may board; the passport only proved who you are.
- **In our app:** a customer may read only their own orders; admin actions need an explicit permission.
- **Watch out:** hiding a button in the UI is not authorization. The server must check on every request, or user A can fetch user B's order by changing an ID in the URL (an IDOR bug).
- **Related:** [Authentication](#authentication)

### Session (server-side)
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** after login, the server stores the user's logged-in state and gives the browser a random session ID in a cookie.
- **Analogy:** a coat-check ticket: the ticket is meaningless alone, and the coat stays with the venue.
- **In our app:** session data will live in the database or Redis so that any app instance can read it.
- **Watch out:** if sessions are kept in one server's memory, users get logged out when the load balancer sends them to a different instance.
- **Related:** [JWT](#jwt-json-web-token), [Stateless instance](#stateless-instance)

### JWT (JSON Web Token)
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** a signed token that carries user claims inside itself, so the server can verify it without a lookup.
- **Analogy:** a festival wristband: staff can check it on sight, but taking it back before it expires is hard.
- **In our app:** we will decode one in Phase 3 to see that its contents are readable and that tampering breaks the signature.
- **Watch out:** *signed is not encrypted*. Anyone can read a JWT's payload. Revoking a JWT before it expires is hard, so lifetimes are kept short and paired with refresh tokens.
- **Related:** [Session](#session-server-side), [OAuth 2.0](#oauth-20)

### OAuth 2.0
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** a protocol that lets a user grant an application limited access to an API on their behalf, using access tokens with scopes.
- **Analogy:** a hotel key card that opens only your room and the gym, for a fixed time, without handing over the master key.
- **In our app:** used under the hood when signing in with an external provider; the web flow is "authorization code with PKCE."
- **Watch out:** OAuth on its own is about *access*, not *identity*. It is not a login protocol; that is what OpenID Connect adds.
- **Related:** [OpenID Connect](#openid-connect-oidc), [Authorization](#authorization)

### OpenID Connect (OIDC)
**Status:** 🌱 Introduced · **Roadmap:** Phase 3

- **In one sentence:** an identity layer on top of OAuth 2.0 that adds an ID token saying who the user is.
- **Analogy:** OAuth gives you the key card; OIDC also hands you a verified name badge.
- **In our app:** "Sign in with Google/GitHub" in Phase 3.
- **Watch out:** let a provider or established library run this flow; hand-written token validation is a classic source of vulnerabilities.
- **Related:** [OAuth 2.0](#oauth-20), [Authentication](#authentication)

### Environment variables and secrets
**Status:** 🔧 Built · **Roadmap:** Phase 2, Phase 12

- **In one sentence:** configuration (database URLs, API keys) is supplied to the app from its environment instead of being written into the code.
- **Analogy:** the same car driven by different drivers, each bringing their own keys.
- **In our app:** `storefront/.gitignore` ignores every `.env*` file except `.env.example`, which lists variable names with safe placeholders.
- **Watch out:** never commit real secrets. The default `.env*` rule would also have hidden `.env.example`, so we added the `!.env.example` exception.
- **Related:** [Container and image](#container-and-image)

---

## Data

### Source of truth
**Status:** 🌱 Introduced · **Roadmap:** Phase 2, Phase 6

- **In one sentence:** the one place whose data is authoritative when copies disagree.
- **Analogy:** the bank's ledger, not the balance shown on an ATM receipt.
- **In our app:** PostgreSQL is the source of truth for orders, stock, and prices.
- **Watch out:** checkout must read stock and prices from the source of truth, never from a cache or from the browser.
- **Related:** [Cache](#cache), [Relational vs document database](#relational-vs-document-database)

### Relational vs document database
**Status:** 🌱 Introduced · **Roadmap:** Phase 2

- **In one sentence:** relational databases (PostgreSQL, MySQL, SQL Server, Oracle) store tables linked by keys and enforce constraints and transactions; document databases (MongoDB) store self-contained JSON-like documents.
- **Analogy:** a set of cross-referenced spreadsheets versus a filing cabinet of complete folders.
- **In our app:** PostgreSQL, because orders, payments, and stock must stay consistent with each other.
- **Watch out:** "NoSQL scales, SQL doesn't" is a myth. Choose based on the shape of the data and the guarantees it needs.
- **Related:** [Transaction](#transaction-acid)

### Transaction (ACID)
**Status:** 🌱 Introduced · **Roadmap:** Phase 2

- **In one sentence:** a group of database changes that either all happen or none happen (Atomic, Consistent, Isolated, Durable).
- **Analogy:** a bank transfer: money must not leave one account without arriving in the other.
- **In our app:** creating the order, reserving stock, and inserting the outbox event happen in one transaction.
- **Watch out:** a transaction covers only that one database. It cannot include a Redis publish or a call to Stripe; see the transactional outbox.
- **Related:** [Transactional outbox](#transactional-outbox)

---

## Asynchronous work and reliability

### Job queue
**Status:** 🌱 Introduced · **Roadmap:** Phase 4

- **In one sentence:** a list of tasks waiting to be done, where each task is handed to one worker and removed when finished.
- **Analogy:** order tickets on a restaurant kitchen rail: each cook takes one ticket, cooks it, and discards it.
- **In our app:** BullMQ on Redis will run email, payment follow-up, and fulfillment jobs so the order request can return quickly.
- **Watch out:** a queue makes the *response* fast, not the *work*. Workers still need retries, timeouts, and a place for jobs that keep failing (a dead-letter queue).
- **Related:** [Event log](#event-log-kafka), [Idempotency](#idempotency), [At-least-once delivery](#at-least-once-delivery)

### Event log (Kafka)
**Status:** 🌱 Introduced · **Roadmap:** Phase 14

- **In one sentence:** an append-only, stored sequence of events that many independent consumers read at their own pace, and can re-read from any point.
- **Analogy:** a newspaper archive: every department reads the same editions, and anyone can go back and reread last month.
- **In our app:** optional Phase 14, where notifications and analytics both consume the same order events.
- **Watch out:** Kafka is not "a faster job queue." Pick it for multiple consumers, replay, and high-volume streams, not for a single background task.
- **Related:** [Job queue](#job-queue)

### Transactional outbox
**Status:** 🌱 Introduced · **Roadmap:** Phase 4

- **In one sentence:** write the "work to do" as a row in the same database transaction as the business change, and let a separate relay publish it to the queue afterward.
- **Analogy:** writing a to-do note in the same ledger entry as the sale, so the follow-up can never be forgotten even if the clerk walks away.
- **In our app:** the order and its outbox event are committed together; the outbox relay later pushes the event to BullMQ.
- **Watch out:** "save to database, then publish to Redis" in one function loses work if the process crashes between the two steps.
- **Related:** [Transaction](#transaction-acid), [At-least-once delivery](#at-least-once-delivery)

### At-least-once delivery
**Status:** 🌱 Introduced · **Roadmap:** Phase 4

- **In one sentence:** a message is guaranteed to arrive, but it may arrive more than once.
- **Analogy:** a courier who redelivers whenever unsure the first delivery succeeded.
- **In our app:** both the outbox relay and BullMQ can deliver a job twice, for example after a crash or timeout.
- **Watch out:** never assume "exactly once." Make the receiver idempotent instead.
- **Related:** [Idempotency](#idempotency), [Job queue](#job-queue)

### Idempotency
**Status:** 🌱 Introduced · **Roadmap:** Phase 4, Phase 5

- **In one sentence:** doing an operation twice has the same effect as doing it once.
- **Analogy:** pressing an elevator button five times still calls one elevator.
- **In our app:** each job and webhook carries a stable ID; the database records processed IDs so a repeat does nothing.
- **Watch out:** "send email" and "charge card" are *not* naturally idempotent. You make them idempotent with a unique key and a check.
- **Related:** [At-least-once delivery](#at-least-once-delivery)

---

## Performance and scaling

### Cache
**Status:** 🌱 Introduced · **Roadmap:** Phase 6

- **In one sentence:** a fast, temporary copy of data kept close to where it is needed, so repeated reads skip slower work.
- **Analogy:** short-term memory, while the database is long-term memory.
- **In our app:** Redis may cache product listings, but only after measuring that the catalog read is slow.
- **Watch out:** a cache can be stale or empty at any moment. The app must still work (more slowly) if Redis is down, and must never trust cached stock or prices at checkout.
- **Related:** [Source of truth](#source-of-truth)

### Latency percentiles (p50, p95, p99)
**Status:** 🌱 Introduced · **Roadmap:** Phase 1, Phase 11

- **In one sentence:** p95 latency is the response time that 95% of requests are faster than.
- **Analogy:** "most deliveries arrive in a day" (p50) hides the customers who waited a week (p99).
- **In our app:** every load test records p50, p95, and p99 before and after a change.
- **Watch out:** averages hide slow outliers, and those outliers are often your busiest users.
- **Related:** [Bottleneck-first](#bottleneck-first-measure-before-you-optimize), [Metrics, logs, and traces](#metrics-logs-and-traces)

### Vertical vs horizontal scaling
**Status:** 🌱 Introduced · **Roadmap:** Phase 8

- **In one sentence:** vertical scaling gives one server more CPU and memory; horizontal scaling adds more servers behind a load balancer.
- **Analogy:** hiring a faster cashier versus opening more checkout lanes.
- **In our app:** Phase 8 runs 2–3 app instances behind Nginx and measures where throughput stops improving.
- **Watch out:** horizontal scaling only works if the app is stateless, and it usually moves the bottleneck to the database.
- **Related:** [Stateless instance](#stateless-instance), [Load balancer](#load-balancer), [Autoscaling](#autoscaling)

### Stateless instance
**Status:** 🌱 Introduced · **Roadmap:** Phase 8

- **In one sentence:** an app server that keeps no user-specific data in its own memory or disk between requests, so any instance can handle any request.
- **Analogy:** interchangeable cashiers who look everything up in a shared system rather than remembering customers personally.
- **In our app:** sessions, cache, and jobs live in PostgreSQL or Redis; all Next.js instances share the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and deployment ID.
- **Watch out:** in-memory sessions, local file uploads, and per-instance keys silently break as soon as a second instance exists.
- **Related:** [Horizontal scaling](#vertical-vs-horizontal-scaling), [Session](#session-server-side)

### Autoscaling
**Status:** 🌱 Introduced · **Roadmap:** Phase 13

- **In one sentence:** automatically adding or removing instances based on a measured signal such as CPU or queue length.
- **Analogy:** a shop that opens more checkout lanes when the line grows and closes them when it shrinks.
- **In our app:** a Kubernetes Horizontal Pod Autoscaler for web pods, and queue-length-based scaling (KEDA) for workers.
- **Watch out:** Kubernetes does not scale with traffic by default. Autoscaling must be configured, and the signal must match the workload: workers should scale on queue lag, not CPU.
- **Related:** [Kubernetes](#kubernetes), [Vertical vs horizontal scaling](#vertical-vs-horizontal-scaling)

---

## Infrastructure and delivery

### Container and image
**Status:** 🌱 Introduced · **Roadmap:** Phase 2, Phase 7

- **In one sentence:** an image is a packaged, read-only snapshot of an app and its runtime; a container is a running instance of that image.
- **Analogy:** a recipe card (image) versus a dish being cooked from it (container).
- **In our app:** Docker Compose runs PostgreSQL and Redis first; in Phase 7 the app and worker become images too.
- **Watch out:** a container's filesystem is temporary. Anything written inside it is lost on restart unless it goes to a volume or an external service.
- **Related:** [Kubernetes](#kubernetes), [Environment variables and secrets](#environment-variables-and-secrets)

### Kubernetes
**Status:** 🌱 Introduced · **Roadmap:** Phase 13

- **In one sentence:** a system that runs containers across many machines, restarts failed ones, rolls out new versions, and routes traffic to healthy ones.
- **Analogy:** an air-traffic controller for containers.
- **In our app:** a local cluster (kind or k3d) in Phase 13, after simpler deployment options have been tried.
- **Watch out:** Kubernetes carries a large operational cost. For small systems, a managed container service is often the better choice.
- **Related:** [Autoscaling](#autoscaling), [Container and image](#container-and-image)

### Monorepo
**Status:** 🔧 Built · **Roadmap:** Repository layout

- **In one sentence:** one Git repository that holds several related parts of a system (web app, worker, infrastructure, docs) in separate folders.
- **Analogy:** one binder with labeled tabs, instead of a separate binder for every chapter.
- **In our app:** `scalling-backend/` is the repository; `storefront/` is one folder inside it, and `worker/`, `infra/`, and `.github/workflows/` will join it.
- **Watch out:** a folder that still contains its own `.git` becomes a *nested repository*, and the outer repo tracks it as a single opaque entry instead of its files. We removed `storefront/.git` before creating the root repo for this reason.
- **Related:** [CI/CD pipeline](#cicd-pipeline)

### CI/CD pipeline
**Status:** 🌱 Introduced · **Roadmap:** Phase 10

- **In one sentence:** Continuous Integration automatically tests every change; Continuous Delivery/Deployment automatically ships changes that pass.
- **Analogy:** a factory line with quality inspectors at every station before a product leaves.
- **In our app:** GitHub Actions; the concepts transfer to GitLab CI, Azure DevOps, and Jenkins.
- **Watch out:** build the image once and promote the same image through environments. Rebuilding per environment means you deploy something you never tested.
- **Related:** [Container and image](#container-and-image)

### Infrastructure as code
**Status:** 🌱 Introduced · **Roadmap:** Phase 12

- **In one sentence:** defining servers, networks, and databases in version-controlled files that a tool (Terraform/OpenTofu) applies.
- **Analogy:** a building blueprint instead of verbal instructions to the builders.
- **In our app:** staging cloud infrastructure in Phase 12, recreated from scratch to prove it works.
- **Watch out:** changes made by hand in a cloud console cause "drift" from the code.
- **Related:** [CI/CD pipeline](#cicd-pipeline)

---

## Observability

### Metrics, logs, and traces
**Status:** 🌱 Introduced · **Roadmap:** Phase 11

- **In one sentence:** the three signals for understanding a running system: metrics are numbers over time, logs are records of individual events, and traces follow one request across every component.
- **Analogy:** metrics are a car's dashboard gauges, logs are the trip diary, and a trace is the GPS route of one journey.
- **In our app:** Prometheus collects metrics, Grafana visualizes them, structured logs carry request/order/job IDs, and OpenTelemetry produces traces.
- **Watch out:** a metric label with unbounded values, such as user IDs, explodes Prometheus storage (high cardinality).
- **Related:** [Prometheus and Grafana](#prometheus-and-grafana), [Latency percentiles](#latency-percentiles-p50-p95-p99)

### Prometheus and Grafana
**Status:** 🌱 Introduced · **Roadmap:** Phase 11

- **In one sentence:** Prometheus periodically pulls (scrapes) metrics from services and stores them; Grafana turns them into dashboards and alerts.
- **Analogy:** Prometheus is the meter reader visiting every house; Grafana is the chart on the utility bill.
- **In our app:** dashboards for checkout response time, error rate, queue depth, worker crashes, and CPU/memory use.
- **Watch out:** a dashboard nobody watches is not monitoring. Alerts should fire on symptoms users feel, such as slow or failing checkout.
- **Related:** [Metrics, logs, and traces](#metrics-logs-and-traces)

---

## Open questions

Things that are still unclear. Write them here as they come up, and move each into a glossary entry once it is answered.

- _(none yet)_

## Changelog

| Date | Change |
|---|---|
| 2026-10-09 | Created the glossary with concepts introduced during the roadmap review. Marked environment variables and secrets as built (`.env.example` exception in `.gitignore`). |
| 2026-10-09 | Added Monorepo (🔧): made `scalling-backend/` the Git repository and removed the nested `storefront/.git`. |
