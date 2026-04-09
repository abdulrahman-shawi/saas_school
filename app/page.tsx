import Link from "next/link";

/**
 * Home page with quick access to authentication flow.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-14">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          School Management SaaS
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">
          Multi-tenant Academy Portal
        </h1>
        <p className="mt-4 text-slate-600">
          Login with academy code, username, and password. Middleware protects
          private dashboard routes with JWT sessions.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700"
          >
            Go to Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
