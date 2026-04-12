import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import TeachersPanel from "./teachers-panel";
import { getServerSession } from "@/lib/session";

/**
 * Renders teachers management page for academy admin users.
 */
export default async function TeachersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Academy Admin Panel</p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Teachers Management
              </h1>
            </div>
            <Link
              href="/dashboard/admin"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <TeachersPanel />
      </section>
    </main>
  );
}
