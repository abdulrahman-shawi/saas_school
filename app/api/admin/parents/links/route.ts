import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gets all parent-student links by academy scope.
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

  const links = await prisma.parentStudentLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { fullName: true, username: true } },
        },
      },
      student: {
        select: {
          id: true,
          studentCode: true,
          firstName: true,
          lastName: true,
          user: { select: { fullName: true, username: true } },
        },
      },
    },
  });

  return NextResponse.json({
    links: links.map((link) => ({
      id: link.id,
      academyId: link.academyId,
      academyCode: link.academy.code,
      academyName: link.academy.name,
      relation: link.relation,
      isPrimary: link.isPrimary,
      parentId: link.parentId,
      parentName: link.parent.user.fullName,
      parentUsername: link.parent.user.username,
      studentId: link.studentId,
      studentName: link.student.user.fullName,
      studentCode: link.student.studentCode,
      studentUsername: link.student.user.username,
      createdAt: link.createdAt,
    })),
  });
}