import { Gender, Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { getNextBillingDate, syncStudentSubscriptionsForAcademy } from "@/lib/student-subscription";
import { NextRequest, NextResponse } from "next/server";

const createStudentSchema = z.object({
  academyId: z.string().uuid().optional(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  studentCode: z.string().min(2).optional(),
  rollNumber: z.string().optional().or(z.literal("")),
  classroomId: z.string().uuid().optional().or(z.literal("")),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  caste: z.string().optional(),
  religion: z.string().optional(),
  mobileNumber: z.string().optional(),
  profilePicUrl: z.string().url().optional().or(z.literal("")),
  bloodGroup: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  feeCollectionAmount: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  status: z.nativeEnum(UserStatus).optional(),
  note: z.string().optional(),
});

function buildStudentCode(sequence: number): string {
  return `S-${String(sequence).padStart(3, "0")}`;
}

async function generateStudentCode(tx: Prisma.TransactionClient, academyId: string): Promise<string> {
  const existing = await tx.studentProfile.findMany({
    where: { academyId },
    select: { studentCode: true },
  });

  const usedCodes = new Set(existing.map((item) => item.studentCode));
  let sequence = existing.length + 1;

  while (usedCodes.has(buildStudentCode(sequence))) {
    sequence += 1;
  }

  return buildStudentCode(sequence);
}

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

  if ("academyId" in where && typeof where.academyId === "string") {
    await syncStudentSubscriptionsForAcademy(where.academyId);
  }

  const students = await prisma.studentProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, code: true, name: true } },
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
      parentLinks: {
        include: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    students: students.map((student) => ({
      id: student.id,
      userId: student.user.id,
      academyId: student.academyId,
      academyCode: student.academy.code,
      academyName: student.academy.name,
      studentCode: student.studentCode,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: student.user.fullName,
      username: student.user.username,
      email: student.user.email,
      mobileNumber: student.user.phone,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      admissionDate: student.enrollmentDate,
      classroomId: student.classroomId,
      classroomCode: student.classroom?.code ?? null,
      classroomName: student.classroom?.name ?? null,
      rollNumber: student.rollNumber,
      caste: student.caste,
      religion: student.religion,
      profilePicUrl: student.profilePicUrl,
      bloodGroup: student.bloodGroup,
      height: student.height,
      weight: student.weight,
      feeCollectionAmount: student.feeCollectionAmount?.toString() ?? null,
      accessActiveUntil: student.accessActiveUntil,
      note: student.notes,
      status: student.user.status,
      parents: student.parentLinks.map((link) => ({
        id: link.parent.id,
        fullName: link.parent.user.fullName,
      })),
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = createStudentSchema.safeParse(await request.json());

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

  if (payload.classroomId) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: payload.classroomId, academyId: scope.academyId },
      select: { id: true },
    });

    if (!classroom) {
      return NextResponse.json({ message: "Classroom not found." }, { status: 404 });
    }
  }

  try {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`;
    const enrollmentDate = payload.admissionDate ? new Date(payload.admissionDate) : new Date();
    const initialAccessActiveUntil = (payload.status ?? UserStatus.ACTIVE) === UserStatus.ACTIVE
      ? getNextBillingDate(enrollmentDate, enrollmentDate)
      : null;

    const created = await prisma.$transaction(async (tx) => {
      const studentCode = payload.studentCode?.trim().toUpperCase() || await generateStudentCode(tx, scope.academyId);

      const user = await tx.user.create({
        data: {
          academyId: scope.academyId,
          username: studentCode,
          fullName,
          email: payload.email?.trim() || null,
          phone: payload.mobileNumber?.trim() || null,
          passwordHash,
          role: UserRole.STUDENT,
          status: payload.status ?? UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const student = await tx.studentProfile.create({
        data: {
          academyId: scope.academyId,
          userId: user.id,
          classroomId: payload.classroomId?.trim() || null,
          studentCode,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          rollNumber: payload.rollNumber?.trim() || null,
          gender: payload.gender ?? null,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          enrollmentDate,
          accessActiveUntil: initialAccessActiveUntil,
          lastActivatedAt: initialAccessActiveUntil ? new Date() : null,
          profilePicUrl: payload.profilePicUrl?.trim() || null,
          caste: payload.caste?.trim() || null,
          religion: payload.religion?.trim() || null,
          bloodGroup: payload.bloodGroup?.trim() || null,
          height: payload.height?.trim() || null,
          weight: payload.weight?.trim() || null,
          feeCollectionAmount: payload.feeCollectionAmount?.trim() ? payload.feeCollectionAmount.trim() : null,
          notes: payload.note?.trim() || null,
        },
      });

      return { user, student };
    });

    return NextResponse.json({ message: "Student created.", student: created });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Student code, username, email, or roll number already exists."
      : "Failed to create student.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
