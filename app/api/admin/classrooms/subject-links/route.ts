import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gets all classroom-subject links by academy scope.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);
  const academyIdQuery = request.nextUrl.searchParams.get("academyId")?.trim();

  const where = isSuperAdmin
    ? academyIdQuery
      ? { academyId: academyIdQuery }
      : {}
    : { academyId: session.academyId };

  const links = await prisma.classroomCourse.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true, isActive: true } },
    },
  });

  return NextResponse.json({
    links: links.map((link) => ({
      id: link.id,
      academyId: link.academyId,
      academyCode: link.academy.code,
      academyName: link.academy.name,
      classroomId: link.classroomId,
      classroomCode: link.classroom.code,
      classroomName: link.classroom.name,
      subjectId: link.courseId,
      subjectCode: link.course.code,
      subjectName: link.course.name,
      subjectStatus: link.course.isActive ? "ACTIVE" : "INACTIVE",
    })),
  });
}
