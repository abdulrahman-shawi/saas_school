import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

const createClassroomSchema = z.object({
  academyId: z.string().uuid().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  capacity: z.number().int().positive().optional().nullable(),
  teacherIds: z.array(z.string().uuid()).optional().default([]),
});

interface AccessScope {
  isSuperAdmin: boolean;
  academyId: string;
}

/**
 * Returns access scope for classroom management endpoints.
 */
async function resolveScope(academyIdFromQuery?: string | null): Promise<AccessScope | NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

  if (isSuperAdmin) {
    const academyId = academyIdFromQuery?.trim() || "";

    if (!academyId) {
      return NextResponse.json(
        { message: "academyId is required for super admin requests." },
        { status: 400 },
      );
    }

    return { isSuperAdmin: true, academyId };
  }

  return { isSuperAdmin: false, academyId: session.academyId };
}

/**
 * Returns classrooms with linked teachers according to tenant scope.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const scopeResult = await resolveScope(request.nextUrl.searchParams.get("academyId"));

  if (scopeResult instanceof NextResponse) {
    return scopeResult;
  }

  const classrooms = await prisma.classroom.findMany({
    where: {
      academyId: scopeResult.academyId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      academy: {
        select: { id: true, code: true, name: true },
      },
      teachers: {
        orderBy: { createdAt: "asc" },
        include: {
          teacher: {
            select: {
              id: true,
              teacherCode: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  username: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    classrooms: classrooms.map((classroom) => ({
      id: classroom.id,
      academyId: classroom.academyId,
      academyCode: classroom.academy.code,
      academyName: classroom.academy.name,
      code: classroom.code,
      name: classroom.name,
      capacity: classroom.capacity,
      isActive: classroom.isActive,
      createdAt: classroom.createdAt,
      teachers: classroom.teachers.map((link) => ({
        teacherId: link.teacher.id,
        teacherCode: link.teacher.teacherCode,
        fullName: link.teacher.user.fullName,
        username: link.teacher.user.username,
      })),
    })),
  });
}

/**
 * Creates a classroom and links selected teachers to it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const payloadResult = createClassroomSchema.safeParse(await request.json());

  if (!payloadResult.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = payloadResult.data;
  const scopeResult = await resolveScope(payload.academyId ?? null);

  if (scopeResult instanceof NextResponse) {
    return scopeResult;
  }

  const academy = await prisma.academy.findUnique({
    where: { id: scopeResult.academyId },
    select: { id: true },
  });

  if (!academy) {
    return NextResponse.json({ message: "Academy not found." }, { status: 404 });
  }

  if (payload.teacherIds.length > 0) {
    const teacherCount = await prisma.teacherProfile.count({
      where: {
        academyId: scopeResult.academyId,
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
    const classroom = await prisma.$transaction(async (tx) => {
      const createdClassroom = await tx.classroom.create({
        data: {
          academyId: scopeResult.academyId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          capacity: payload.capacity ?? null,
          isActive: true,
        },
      });

      if (payload.teacherIds.length > 0) {
        await tx.classroomTeacher.createMany({
          data: payload.teacherIds.map((teacherId) => ({
            academyId: scopeResult.academyId,
            classroomId: createdClassroom.id,
            teacherId,
          })),
        });
      }

      return createdClassroom;
    });

    return NextResponse.json({ message: "Classroom created.", classroom });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Classroom code already exists in this academy."
        : "Failed to create classroom.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
