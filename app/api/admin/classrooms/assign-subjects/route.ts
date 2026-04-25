import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const assignSubjectsSchema = z.object({
  classroomId: z.string().uuid(),
  subjectIds: z.array(z.string().uuid()),
});

/**
 * Replaces classroom subject links with the provided subject set.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const parsed = assignSubjectsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const { classroomId, subjectIds } = parsed.data;

  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { id: true, academyId: true },
    });

    if (!classroom) {
      return NextResponse.json({ message: "Classroom not found." }, { status: 404 });
    }

    const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

    if (!isSuperAdmin && classroom.academyId !== session.academyId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (subjectIds.length > 0) {
      const subjectsCount = await prisma.course.count({
        where: {
          academyId: classroom.academyId,
          id: { in: subjectIds },
        },
      });

      if (subjectsCount !== subjectIds.length) {
        return NextResponse.json({ message: "Some selected subjects do not belong to this classroom academy." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.classroomCourse.deleteMany({
        where: { classroomId },
      });

      if (subjectIds.length > 0) {
        await tx.classroomCourse.createMany({
          data: subjectIds.map((courseId) => ({
            academyId: classroom.academyId,
            classroomId,
            courseId,
          })),
        });
      }
    });

    return NextResponse.json({
      message: "Classroom subjects updated.",
      count: subjectIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign subjects.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
