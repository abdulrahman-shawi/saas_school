import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerSession } from "@/lib/session";

/**
 * Dashboard page for authenticated users.
 */
export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-lg">
        <p className="text-sm text-slate-500">Signed in as</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          {session.fullName}
        </h1>
        <p className="mt-3 text-slate-700">
          Academy: <span className="font-medium">{session.academyName}</span>
        </p>
        <p className="text-slate-700">
          Role: <span className="font-medium">{session.role}</span>
        </p>
        <p className="text-slate-700">
          Username: <span className="font-medium">{session.username}</span>
        </p>

        {session.role === UserRole.ACADEMY_ADMIN && (
          <div className="mt-6">
            <Link
              href="/dashboard/admin"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Open Admin User Management
            </Link>
          </div>
        )}

        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-700"
          >
            Logout
          </button>
        </form>
      </section>
    </main>
  );
}
