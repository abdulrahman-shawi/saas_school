import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateClassroomSchema = z.object({
  code: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  capacity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  teacherIds: z.array(z.string().uuid()).optional(),
});

/**
 * Resolves the authenticated session for classroom write operations.
 */
async function getAuthorizedSession(): Promise<
  | { academyId: string; isSuperAdmin: boolean }
  | NextResponse
> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  return {
    academyId: session.academyId,
    isSuperAdmin: isSuperAdminAcademyCode(session.academyCode),
  };
}

/**
 * Updates classroom data and teacher assignments.
 */
export async function PATCH(
  request: Request,
  context: { params: { classroomId: string } },
): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const payloadResult = updateClassroomSchema.safeParse(await request.json());

  if (!payloadResult.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = payloadResult.data;

  const existing = await prisma.classroom.findUnique({
    where: { id: context.params.classroomId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Classroom not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (payload.teacherIds && payload.teacherIds.length > 0) {
    const teacherCount = await prisma.teacherProfile.count({
      where: {
        academyId: existing.academyId,
        id: { in: payload.teacherIds },
      },
    });

    if (teacherCount !== payload.teacherIds.length) {
      return NextResponse.json(
        { message: "Some selected teachers do not belong to this academy." },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.classroom.update({
        where: { id: context.params.classroomId },
        data: {
          code: payload.code?.trim().toUpperCase(),
          name: payload.name?.trim(),
          capacity: payload.capacity,
          isActive: payload.isActive,
        },
      });

      if (payload.teacherIds) {
        await tx.classroomTeacher.deleteMany({
          where: { classroomId: context.params.classroomId },
        });

        if (payload.teacherIds.length > 0) {
          await tx.classroomTeacher.createMany({
            data: payload.teacherIds.map((teacherId) => ({
              academyId: existing.academyId,
              classroomId: context.params.classroomId,
              teacherId,
            })),
          });
        }
      }
    });

    return NextResponse.json({ message: "Classroom updated." });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Classroom code already exists in this academy."
        : "Failed to update classroom.";

    return NextResponse.json({ message }, { status: 400 });
  }
}

/**
 * Deletes classroom and related teacher links.
 */
export async function DELETE(
  _request: Request,
  context: { params: { classroomId: string } },
): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.classroom.findUnique({
    where: { id: context.params.classroomId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Classroom not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.classroom.delete({ where: { id: context.params.classroomId } });

  return NextResponse.json({ message: "Classroom deleted." });
}
