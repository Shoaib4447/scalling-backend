export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-16">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Backend engineering lab
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Build an order system you can trust.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            A hands-on e-commerce project for learning backend engineering:
            accept an order quickly, persist it safely, and process the rest in
            the background.
          </p>
        </header>

        <section aria-labelledby="order-flow" className="mb-14">
          <h2 id="order-flow" className="mb-5 text-xl font-semibold">
            The order journey
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Validate request", "Authenticate, check input, recalculate prices."],
              ["02", "Commit order", "Reserve stock and save an outbox event in PostgreSQL."],
              ["03", "Respond promptly", "Return the order ID and honest current status."],
              ["04", "Run background work", "Retry payment, email, and fulfillment jobs safely."],
            ].map(([number, title, detail]) => (
              <li
                key={number}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <span className="text-sm font-semibold text-cyan-300">{number}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="starting-point"
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8"
        >
          <h2 id="starting-point" className="text-xl font-semibold">
            Starting point
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            This is the project shell. We will add the catalog and order API
            first, then PostgreSQL, authentication, a durable queue, payments,
            automated tests, and production delivery one phase at a time.
          </p>
          <p className="mt-5 text-sm text-slate-400">
            Curriculum: <code className="text-cyan-200">BACKEND-LEARNING-ROADMAP.md</code>
          </p>
        </section>
      </div>
    </main>
  );
}
