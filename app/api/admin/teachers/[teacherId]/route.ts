import { Gender, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateTeacherSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  mobileNumber: z.string().optional(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  dateOfJoining: z.string().optional().nullable(),
  maritalStatus: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  qualification: z.string().optional(),
  workExperience: z.string().optional(),
  note: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

/**
 * Returns authorized session context for teachers write endpoints.
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
 * Updates teacher profile and linked user account.
 */
export async function PATCH(
  request: Request,
  context: { params: { teacherId: string } },
): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const payloadResult = updateTeacherSchema.safeParse(await request.json());

  if (!payloadResult.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = payloadResult.data;

  const existing = await prisma.teacherProfile.findUnique({
    where: { id: context.params.teacherId },
    include: {
      user: {
        select: { id: true, fullName: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
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
          username: payload.username?.trim(),
          fullName,
          email: payload.email?.trim(),
          phone: payload.mobileNumber?.trim() || undefined,
          status: payload.status,
          passwordHash,
        },
      });

      await tx.teacherProfile.update({
        where: { id: context.params.teacherId },
        data: {
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          gender: payload.gender,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : payload.dateOfBirth === null ? null : undefined,
          hireDate: payload.dateOfJoining ? new Date(payload.dateOfJoining) : payload.dateOfJoining === null ? null : undefined,
          maritalStatus: payload.maritalStatus?.trim() || undefined,
          profilePicUrl: payload.profilePicUrl === "" ? null : payload.profilePicUrl?.trim(),
          currentAddress: payload.currentAddress?.trim() || undefined,
          permanentAddress: payload.permanentAddress?.trim() || undefined,
          qualification: payload.qualification?.trim() || undefined,
          workExperience: payload.workExperience?.trim() || undefined,
          note: payload.note?.trim() || undefined,
        },
      });
    });

    return NextResponse.json({ message: "Teacher updated." });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Username or email already exists."
        : "Failed to update teacher.";

    return NextResponse.json({ message }, { status: 400 });
  }
}

/**
 * Deletes teacher account and profile.
 */
export async function DELETE(
  _request: Request,
  context: { params: { teacherId: string } },
): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.teacherProfile.findUnique({
    where: { id: context.params.teacherId },
    include: { user: { select: { id: true } } },
  });

  if (!existing) {
    return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: existing.user.id } });

  return NextResponse.json({ message: "Teacher deleted." });
}
