import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import TimetablePanel from "./timetable-panel";
import { getServerSession } from "@/lib/session";

export default async function TimetablePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <TimetablePanel />
      </section>
    </main>
  );
}