import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns teacher options scoped by academy and super-admin permissions.
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

  const teachers = await prisma.teacherProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      academyId: teacher.academyId,
      academyName: teacher.academy.name,
      academyCode: teacher.academy.code,
      teacherCode: teacher.teacherCode,
      fullName: teacher.user.fullName,
      username: teacher.user.username,
      email: teacher.user.email,
      status: teacher.user.status,
    })),
  });
}
