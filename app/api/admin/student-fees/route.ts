import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { syncStudentSubscriptionsForAcademy } from "@/lib/student-subscription";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);
  const academyIdQuery = request.nextUrl.searchParams.get("academyId")?.trim() || "";
  const showAll = request.nextUrl.searchParams.get("showAll") === "true";
  const academyId = isSuperAdmin ? (academyIdQuery || null) : session.academyId;

  if (isSuperAdmin && !academyId) {
    return NextResponse.json({ students: [] });
  }

  if (!academyId) {
    return NextResponse.json({ message: "academyId is required." }, { status: 400 });
  }

  await syncStudentSubscriptionsForAcademy(academyId);

  const now = new Date();
  const students = await prisma.studentProfile.findMany({
    where: {
      academyId,
      ...(showAll ? {} : { accessActiveUntil: { lte: now } }),
    },
    orderBy: [
      { accessActiveUntil: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      academy: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, code: true, name: true } },
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({
    students: students.map((student) => {
      const dueDate = student.accessActiveUntil;
      const overdueDays = dueDate
        ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        id: student.id,
        userId: student.userId,
        academyId: student.academyId,
        academyCode: student.academy.code,
        academyName: student.academy.name,
        studentCode: student.studentCode,
        fullName: student.user.fullName,
        username: student.user.username,
        classroomName: student.classroom?.name ?? null,
        classroomCode: student.classroom?.code ?? null,
        feeCollectionAmount: student.feeCollectionAmount?.toString() ?? null,
        accessActiveUntil: student.accessActiveUntil,
        status: student.user.status,
        overdueDays,
      };
    }),
  });
}