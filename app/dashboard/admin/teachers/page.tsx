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
        <TeachersPanel />
      </section>
    </main>
  );
}
