import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import SubjectsPanel from "./subjects-panel";
import { getServerSession } from "@/lib/session";

/**
 * Renders subjects management page for academy admins.
 */
export default async function SubjectsPage() {
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
        <SubjectsPanel />
      </section>
    </main>
  );
}
