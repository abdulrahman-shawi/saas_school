import { UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

const createUserSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(3),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

/**
 * Generates role-specific profile codes using a stable prefix and sequence number.
 */
function buildProfileCode(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

/**
 * Returns users in the authenticated academy, optionally filtered by role.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const roleFilter = request.nextUrl.searchParams.get("role");
  const role = Object.values(UserRole).includes(roleFilter as UserRole)
    ? (roleFilter as UserRole)
    : undefined;

  const users = await prisma.user.findMany({
    where: {
      academyId: session.academyId,
      ...(role ? { role } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      studentProfile: { select: { studentCode: true } },
      teacherProfile: { select: { teacherCode: true } },
      staffProfile: { select: { staffCode: true } },
    },
  });

  return NextResponse.json({ users });
}

/**
 * Creates a new academy user and role profile inside the authenticated tenant.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const passwordHash = await bcrypt.hash(payload.password, 10);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          academyId: session.academyId,
          username: payload.username.trim(),
          fullName: payload.fullName.trim(),
          passwordHash,
          role: payload.role,
          status: UserStatus.ACTIVE,
          email: payload.email || null,
          phone: payload.phone || null,
          mustChangePassword: false,
        },
      });

      const defaultBranch = await tx.branch.findFirst({
        where: {
          academyId: session.academyId,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (payload.role === UserRole.STUDENT) {
        const count = await tx.studentProfile.count({
          where: { academyId: session.academyId },
        });

        await tx.studentProfile.create({
          data: {
            academyId: session.academyId,
            userId: user.id,
            branchId: defaultBranch?.id,
            studentCode: buildProfileCode("S", count),
          },
        });
      }

      if (payload.role === UserRole.TEACHER) {
        const count = await tx.teacherProfile.count({
          where: { academyId: session.academyId },
        });

        await tx.teacherProfile.create({
          data: {
            academyId: session.academyId,
            userId: user.id,
            branchId: defaultBranch?.id,
            teacherCode: buildProfileCode("T", count),
          },
        });
      }

      if (payload.role === UserRole.PARENT) {
        await tx.parentProfile.create({
          data: {
            academyId: session.academyId,
            userId: user.id,
          },
        });
      }

      if (payload.role === UserRole.STAFF) {
        const count = await tx.staffProfile.count({
          where: { academyId: session.academyId },
        });

        await tx.staffProfile.create({
          data: {
            academyId: session.academyId,
            userId: user.id,
            branchId: defaultBranch?.id,
            staffCode: buildProfileCode("ST", count),
          },
        });
      }

      return user;
    });

    return NextResponse.json({ message: "User created successfully.", user: created });
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Username or email already exists in this academy."
        : "Failed to create user.";

    return NextResponse.json({ message: errorMessage }, { status: 400 });
  }
}
