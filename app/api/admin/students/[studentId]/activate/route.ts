import { UserRole } from "@prisma/client";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { activateStudentForNextCycle } from "@/lib/student-subscription";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(_request: Request, context: { params: { studentId: string } }): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);
  const student = await prisma.studentProfile.findUnique({
    where: { id: context.params.studentId },
    select: { id: true, academyId: true },
  });

  if (!student) {
    return NextResponse.json({ message: "Student not found." }, { status: 404 });
  }

  if (!isSuperAdmin && student.academyId !== session.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const activated = await activateStudentForNextCycle(student.id, student.academyId);

  if (!activated) {
    return NextResponse.json({ message: "Student not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: "Student activated for the next billing cycle.",
    accessActiveUntil: activated.accessActiveUntil,
  });
}