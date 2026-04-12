import { UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextResponse } from "next/server";

const createAcademySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  username: z.string().min(3),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  password: z.string().min(6),
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

  return null;
}

/**
 * Returns all academies for admin management page.
 */
export async function GET(): Promise<NextResponse> {
  const authError = await assertCanManageAcademies();

  if (authError) {
    return authError;
  }

  const academies = await prisma.academy.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      users: {
        where: { role: UserRole.ACADEMY_ADMIN },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          username: true,
        },
      },
    },
  });

  return NextResponse.json({
    academies: academies.map((academy) => ({
      id: academy.id,
      code: academy.code,
      name: academy.name,
      email: academy.email,
      phone: academy.phone,
      isActive: academy.isActive,
      createdAt: academy.createdAt,
      username: academy.users[0]?.username ?? "admin",
    })),
  });
}

/**
 * Creates academy with a default academy admin account.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authError = await assertCanManageAcademies();

  if (authError) {
    return authError;
  }

  const parsed = createAcademySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const passwordHash = await bcrypt.hash(payload.password, 10);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({
        data: {
          code: payload.code.trim().toLowerCase(),
          name: payload.name.trim(),
          email: payload.email || null,
          phone: payload.phone || null,
        },
      });

      await tx.user.create({
        data: {
          academyId: academy.id,
          username: payload.username.trim(),
          fullName: `${academy.name} Admin`,
          passwordHash,
          role: UserRole.ACADEMY_ADMIN,
          status: UserStatus.ACTIVE,
          email: payload.email || null,
          phone: payload.phone || null,
          mustChangePassword: false,
        },
      });

      return academy;
    });

    return NextResponse.json({ message: "Academy created.", academy: created });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Academy code or username already exists."
        : "Failed to create academy.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
