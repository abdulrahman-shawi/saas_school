import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import ClassroomsPanel from "./classrooms-panel";
import { getServerSession } from "@/lib/session";

/**
 * Renders classrooms and teachers management page for academy admins.
 */
export default async function ClassroomsPage() {
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
        <ClassroomsPanel />
      </section>
    </main>
  );
}
