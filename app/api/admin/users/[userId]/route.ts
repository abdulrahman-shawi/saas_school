import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextResponse } from "next/server";

const updateUserSchema = z.object({
  fullName: z.string().min(3).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

/**
 * Updates an academy user inside the same tenant.
 */
export async function PATCH(
  request: Request,
  context: { params: { userId: string } },
): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const parsed = updateUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      id: context.params.userId,
      academyId: session.academyId,
    },
  });

  if (!existingUser) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: context.params.userId },
    data: {
      fullName: parsed.data.fullName?.trim(),
      email: parsed.data.email === "" ? null : parsed.data.email,
      phone: parsed.data.phone || null,
      status: parsed.data.status,
    },
  });

  return NextResponse.json({ message: "User updated.", user: updated });
}

/**
 * Deletes a user from the authenticated academy.
 */
export async function DELETE(
  _request: Request,
  context: { params: { userId: string } },
): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (context.params.userId === session.sub) {
    return NextResponse.json(
      { message: "You cannot delete your own admin account." },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      id: context.params.userId,
      academyId: session.academyId,
    },
  });

  if (!existingUser) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: context.params.userId } });

  return NextResponse.json({ message: "User deleted." });
}
