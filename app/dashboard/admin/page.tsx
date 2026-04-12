import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import AdminUsersPanel from "./users-panel";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

/**
 * Academy admin dashboard section for managing tenant users.
 */
export default async function AdminDashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    redirect("/dashboard");
  }

  const canManageAcademies = isSuperAdminAcademyCode(session.academyCode);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Academy Admin Panel</p>
              <h1 className="text-2xl font-semibold text-slate-900">
                User Management
              </h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Back to Dashboard
            </Link>
            {canManageAcademies && (
              <Link
                href="/dashboard/admin/academies"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Manage Academies
              </Link>
            )}
          </div>
        </div>

        <AdminUsersPanel />
      </section>
    </main>
  );
}
