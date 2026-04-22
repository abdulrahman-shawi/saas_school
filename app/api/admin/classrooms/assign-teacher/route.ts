import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  classroomIds: z.array(z.string().uuid()).min(1),
});

/**
 * Assigns a teacher to multiple classrooms.
 * POST /api/admin/classrooms/assign-teacher
 * Body: { teacherId, classroomIds: [id1, id2, ...] }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const payloadResult = assignTeacherSchema.safeParse(await request.json());

  if (!payloadResult.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const { teacherId, classroomIds } = payloadResult.data;

  try {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: teacherId },
      select: { id: true, academyId: true },
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
    }

    const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

    if (!isSuperAdmin && teacher.academyId !== session.academyId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const classrooms = await prisma.classroom.findMany({
      where: {
        id: { in: classroomIds },
        academyId: teacher.academyId,
      },
      select: { id: true },
    });

    if (classrooms.length !== classroomIds.length) {
      return NextResponse.json(
        { message: "Some classrooms do not belong to teacher's academy." },
        { status: 400 },
      );
    }

    const existingLinks = await prisma.classroomTeacher.findMany({
      where: {
        teacherId,
        classroomId: { in: classroomIds },
      },
      select: { classroomId: true },
    });

    const existingClassroomIds = new Set(existingLinks.map((link) => link.classroomId));
    const newClassroomIds = classroomIds.filter((id) => !existingClassroomIds.has(id));

    if (newClassroomIds.length > 0) {
      await prisma.classroomTeacher.createMany({
        data: newClassroomIds.map((classroomId) => ({
          academyId: teacher.academyId,
          classroomId,
          teacherId,
        })),
      });
    }

    return NextResponse.json({
      message: "Teacher assigned to classrooms.",
      count: newClassroomIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign teacher.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
