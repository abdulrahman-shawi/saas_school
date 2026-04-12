import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateAcademySchema = z.object({
  code: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

/**
 * Validates that current user can manage academies.
 */
async function assertCanManageAcademies(): Promise<NextResponse | null> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (!isSuperAdminAcademyCode(session.academyCode)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  return null;
}

/**
 * Updates academy profile and optionally resets admin password.
 */
export async function PATCH(
  request: Request,
  context: { params: { academyId: string } },
): Promise<NextResponse> {
  const authError = await assertCanManageAcademies();

  if (authError) {
    return authError;
  }

  const parsed = updateAcademySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;

  const existing = await prisma.academy.findUnique({
    where: { id: context.params.academyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Academy not found." }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updatedAcademy = await tx.academy.update({
        where: { id: context.params.academyId },
        data: {
          code: payload.code?.trim().toLowerCase(),
          name: payload.name?.trim(),
          email: payload.email === "" ? null : payload.email,
          phone: payload.phone || null,
          isActive: payload.isActive,
        },
      });

      const academyAdmin = await tx.user.findFirst({
        where: {
          academyId: context.params.academyId,
          role: UserRole.ACADEMY_ADMIN,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (academyAdmin) {
        const passwordHash =
          payload.password && payload.password !== ""
            ? await bcrypt.hash(payload.password, 10)
            : undefined;

        await tx.user.update({
          where: { id: academyAdmin.id },
          data: {
            username: payload.username?.trim(),
            fullName: payload.name ? `${updatedAcademy.name} Admin` : undefined,
            email: payload.email === "" ? null : payload.email,
            phone: payload.phone || null,
            passwordHash,
          },
        });
      }
    });

    return NextResponse.json({ message: "Academy updated." });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Academy code or username already exists."
        : "Failed to update academy.";

    return NextResponse.json({ message }, { status: 400 });
  }
}

/**
 * Deletes an academy and all related tenant records.
 */
export async function DELETE(
  _request: Request,
  context: { params: { academyId: string } },
): Promise<NextResponse> {
  const authError = await assertCanManageAcademies();

  if (authError) {
    return authError;
  }

  const existing = await prisma.academy.findUnique({
    where: { id: context.params.academyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Academy not found." }, { status: 404 });
  }

  await prisma.academy.delete({ where: { id: context.params.academyId } });

  return NextResponse.json({ message: "Academy deleted." });
}
