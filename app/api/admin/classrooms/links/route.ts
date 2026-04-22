import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gets all classroom-teacher links by academy scope.
 * GET /api/admin/classrooms/links?academyId=xxx
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

  const links = await prisma.classroomTeacher.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: {
        select: { id: true, code: true, name: true },
      },
      classroom: {
        select: { id: true, code: true, name: true },
      },
      teacher: {
        select: {
          id: true,
          teacherCode: true,
          user: {
            select: { fullName: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    links: links.map((link) => ({
      id: link.id,
      classroomId: link.classroomId,
      classroomCode: link.classroom.code,
      classroomName: link.classroom.name,
      teacherId: link.teacherId,
      teacherCode: link.teacher.teacherCode,
      teacherName: link.teacher.user.fullName,
      academyId: link.academyId,
      academyCode: link.academy.code,
      academyName: link.academy.name,
    })),
  });
}
