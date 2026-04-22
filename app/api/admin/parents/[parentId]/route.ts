import { Gender, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateParentSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  occupation: z.string().optional(),
  mobileNumber: z.string().optional(),
  address: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  status: z.nativeEnum(UserStatus).optional(),
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

export async function PATCH(request: Request, context: { params: { parentId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = updateParentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const existing = await prisma.parentProfile.findUnique({
    where: { id: context.params.parentId },
    include: { user: { select: { id: true, fullName: true } } },
  });

  if (!existing) {
    return NextResponse.json({ message: "Parent not found." }, { status: 404 });
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
          fullName,
          email: payload.email === "" ? null : payload.email?.trim(),
          phone: payload.mobileNumber?.trim() || null,
          status: payload.status,
          passwordHash,
        },
      });

      await tx.parentProfile.update({
        where: { id: context.params.parentId },
        data: {
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          gender: payload.gender,
          occupation: payload.occupation?.trim() || undefined,
          address: payload.address?.trim() || undefined,
          profilePicUrl: payload.profilePicUrl === "" ? null : payload.profilePicUrl?.trim(),
        },
      });
    });

    return NextResponse.json({ message: "Parent updated." });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Email already exists in this academy."
      : "Failed to update parent.";

    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: { parentId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.parentProfile.findUnique({
    where: { id: context.params.parentId },
    include: { user: { select: { id: true } } },
  });

  if (!existing) {
    return NextResponse.json({ message: "Parent not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: existing.user.id } });
  return NextResponse.json({ message: "Parent deleted." });
}
