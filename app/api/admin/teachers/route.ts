import { Gender, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

const createTeacherSchema = z.object({
  academyId: z.string().uuid().optional(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  mobileNumber: z.string().optional(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional(),
  dateOfJoining: z.string().optional(),
  maritalStatus: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  qualification: z.string().optional(),
  workExperience: z.string().optional(),
  note: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

interface Scope {
  academyId: string;
  isSuperAdmin: boolean;
}

/**
 * Resolves tenant scope for teachers endpoints.
 */
async function resolveScope(academyIdFromRequest?: string | null): Promise<Scope | NextResponse> {
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

/**
 * Builds academy prefix from academy name/code first character.
 */
function buildAcademyPrefix(academyName: string, academyCode: string): string {
  const source = `${academyName}${academyCode}`.trim();
  const firstLetter = source.match(/[A-Za-z\u0600-\u06FF]/)?.[0] ?? "X";

  return firstLetter.toUpperCase();
}

/**
 * Builds teacher code in academy-scoped sequence.
 */
function buildTeacherCode(academyPrefix: string, count: number): string {
  return `${academyPrefix}-T-${String(count + 1).padStart(3, "0")}`;
}

/**
 * Lists teachers in tenant scope.
 */
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

  const teachers = await prisma.teacherProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
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
    },
  });

  return NextResponse.json({
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      academyId: teacher.academyId,
      academyCode: teacher.academy.code,
      academyName: teacher.academy.name,
      teacherCode: teacher.teacherCode,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      fullName: teacher.user.fullName,
      username: teacher.user.username,
      email: teacher.user.email,
      mobileNumber: teacher.user.phone,
      gender: teacher.gender,
      dateOfBirth: teacher.dateOfBirth,
      dateOfJoining: teacher.hireDate,
      maritalStatus: teacher.maritalStatus,
      profilePicUrl: teacher.profilePicUrl,
      currentAddress: teacher.currentAddress,
      permanentAddress: teacher.permanentAddress,
      qualification: teacher.qualification,
      workExperience: teacher.workExperience,
      note: teacher.note,
      status: teacher.user.status,
    })),
  });
}

/**
 * Creates teacher account and profile.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const payloadResult = createTeacherSchema.safeParse(await request.json());

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
    select: { id: true, name: true, code: true },
  });

  if (!academy) {
    return NextResponse.json({ message: "Academy not found." }, { status: 404 });
  }

  try {
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.teacherProfile.count({
        where: { academyId: scopeResult.academyId },
      });
      const academyPrefix = buildAcademyPrefix(academy.name, academy.code);

      const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`;

      const user = await tx.user.create({
        data: {
          academyId: scopeResult.academyId,
          username: payload.username.trim(),
          fullName,
          email: payload.email.trim(),
          phone: payload.mobileNumber?.trim() || null,
          passwordHash,
          role: UserRole.TEACHER,
          status: payload.status ?? UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const teacher = await tx.teacherProfile.create({
        data: {
          academyId: scopeResult.academyId,
          userId: user.id,
          teacherCode: buildTeacherCode(academyPrefix, count),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          gender: payload.gender ?? null,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          hireDate: payload.dateOfJoining ? new Date(payload.dateOfJoining) : null,
          maritalStatus: payload.maritalStatus?.trim() || null,
          profilePicUrl: payload.profilePicUrl?.trim() || null,
          currentAddress: payload.currentAddress?.trim() || null,
          permanentAddress: payload.permanentAddress?.trim() || null,
          qualification: payload.qualification?.trim() || null,
          workExperience: payload.workExperience?.trim() || null,
          note: payload.note?.trim() || null,
        },
      });

      return { user, teacher };
    });

    return NextResponse.json({ message: "Teacher created.", teacher: created });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Username, email, or teacher code already exists."
        : "Failed to create teacher.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
