import { Gender, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateStudentSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  studentCode: z.string().min(2).optional(),
  rollNumber: z.string().optional().or(z.literal("")),
  classroomId: z.string().uuid().optional().or(z.literal("")),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  admissionDate: z.string().optional().nullable(),
  caste: z.string().optional(),
  religion: z.string().optional(),
  mobileNumber: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  bloodGroup: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  status: z.nativeEnum(UserStatus).optional(),
  note: z.string().optional(),
});

async function getAuthorizedSession(): Promise<{ academyId: string; isSuperAdmin: boolean } | NextResponse> {
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

export async function PATCH(request: Request, context: { params: { studentId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = updateStudentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;

  const existing = await prisma.studentProfile.findUnique({
    where: { id: context.params.studentId },
    include: { user: { select: { id: true, fullName: true } } },
  });

  if (!existing) {
    return NextResponse.json({ message: "Student not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (payload.classroomId) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: payload.classroomId, academyId: existing.academyId },
      select: { id: true },
    });

    if (!classroom) {
      return NextResponse.json({ message: "Classroom not found." }, { status: 404 });
    }
  }

  try {
    const fullName = payload.firstName && payload.lastName
      ? `${payload.firstName.trim()} ${payload.lastName.trim()}`
      : existing.user.fullName;
    const passwordHash = payload.password && payload.password !== ""
      ? await bcrypt.hash(payload.password, 10)
      : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user.id },
        data: {
          username: payload.studentCode?.trim().toUpperCase(),
          fullName,
          email: payload.email === "" ? null : payload.email?.trim(),
          phone: payload.mobileNumber?.trim() || null,
          status: payload.status,
          passwordHash,
        },
      });

      await tx.studentProfile.update({
        where: { id: context.params.studentId },
        data: {
          classroomId: payload.classroomId === "" ? null : payload.classroomId,
          studentCode: payload.studentCode?.trim().toUpperCase(),
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          rollNumber: payload.rollNumber === "" ? null : payload.rollNumber?.trim(),
          gender: payload.gender,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : payload.dateOfBirth === null ? null : undefined,
          enrollmentDate: payload.admissionDate ? new Date(payload.admissionDate) : undefined,
          profilePicUrl: payload.profilePicUrl === "" ? null : payload.profilePicUrl?.trim(),
          caste: payload.caste?.trim() || undefined,
          religion: payload.religion?.trim() || undefined,
          bloodGroup: payload.bloodGroup?.trim() || undefined,
          height: payload.height?.trim() || undefined,
          weight: payload.weight?.trim() || undefined,
          notes: payload.note?.trim() || undefined,
        },
      });
    });

    return NextResponse.json({ message: "Student updated." });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Student code, username, email, or roll number already exists."
      : "Failed to update student.";

    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: { studentId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.studentProfile.findUnique({
    where: { id: context.params.studentId },
    include: { user: { select: { id: true } } },
  });

  if (!existing) {
    return NextResponse.json({ message: "Student not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: existing.user.id } });
  return NextResponse.json({ message: "Student deleted." });
}
