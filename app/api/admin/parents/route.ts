import { Gender, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

const createParentSchema = z.object({
  academyId: z.string().uuid().optional(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  gender: z.nativeEnum(Gender).optional().nullable(),
  occupation: z.string().optional(),
  mobileNumber: z.string().optional(),
  address: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  status: z.nativeEnum(UserStatus).optional(),
});

async function resolveScope(academyIdFromRequest?: string | null): Promise<{ academyId: string; isSuperAdmin: boolean } | NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

  if (isSuperAdmin) {
    const academyId = academyIdFromRequest?.trim() || "";

    if (!academyId) {
      return NextResponse.json({ message: "academyId is required." }, { status: 400 });
    }

    return { academyId, isSuperAdmin: true };
  }

  return { academyId: session.academyId, isSuperAdmin: false };
}

function buildUsernameBase(firstName: string, lastName: string): string {
  const base = `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return base || "parent";
}

async function generateUsername(academyId: string, firstName: string, lastName: string): Promise<string> {
  const base = buildUsernameBase(firstName, lastName);
  let username = base;
  let suffix = 2;

  while (await prisma.user.findFirst({ where: { academyId, username }, select: { id: true } })) {
    username = `${base}.${suffix}`;
    suffix += 1;
  }

  return username;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);
  const academyIdQuery = request.nextUrl.searchParams.get("academyId")?.trim();

  const where = isSuperAdmin
    ? academyIdQuery
      ? { academyId: academyIdQuery }
      : {}
    : { academyId: session.academyId };

  const parents = await prisma.parentProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      links: {
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    parents: parents.map((parent) => ({
      id: parent.id,
      academyId: parent.academyId,
      academyCode: parent.academy.code,
      academyName: parent.academy.name,
      firstName: parent.firstName,
      lastName: parent.lastName,
      fullName: parent.user.fullName,
      username: parent.user.username,
      email: parent.user.email,
      mobileNumber: parent.user.phone,
      gender: parent.gender,
      occupation: parent.occupation,
      address: parent.address,
      profilePicUrl: parent.profilePicUrl,
      status: parent.user.status,
      students: parent.links.map((link) => ({
        id: link.student.id,
        fullName: link.student.user.fullName,
        studentCode: link.student.studentCode,
      })),
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = createParentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const scope = await resolveScope(payload.academyId ?? null);

  if (scope instanceof NextResponse) {
    return scope;
  }

  const academy = await prisma.academy.findUnique({
    where: { id: scope.academyId },
    select: { id: true },
  });

  if (!academy) {
    return NextResponse.json({ message: "Academy not found." }, { status: 404 });
  }

  try {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`;
    const username = await generateUsername(scope.academyId, payload.firstName, payload.lastName);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          academyId: scope.academyId,
          username,
          fullName,
          email: payload.email?.trim() || null,
          phone: payload.mobileNumber?.trim() || null,
          passwordHash,
          role: UserRole.PARENT,
          status: payload.status ?? UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const parent = await tx.parentProfile.create({
        data: {
          academyId: scope.academyId,
          userId: user.id,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          gender: payload.gender ?? null,
          occupation: payload.occupation?.trim() || null,
          address: payload.address?.trim() || null,
          profilePicUrl: payload.profilePicUrl?.trim() || null,
        },
      });

      return { user, parent };
    });

    return NextResponse.json({ message: "Parent created.", parent: created });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Email already exists in this academy."
      : "Failed to create parent.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
