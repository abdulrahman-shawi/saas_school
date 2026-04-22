import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import AcademiesPanel from "./academies-panel";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

/**
 * Renders academy management page for admin users.
 */
export default async function AcademiesManagementPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    redirect("/dashboard");
  }

  if (!isSuperAdminAcademyCode(session.academyCode)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <AcademiesPanel />
      </section>
    </main>
  );
}
