import { Prisma, UserRole, Weekday } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { isValidTimeRange } from "@/lib/timetable";
import { NextRequest, NextResponse } from "next/server";

const timetableSchema = z.object({
  academyId: z.string().uuid().optional(),
  classroomId: z.string().uuid(),
  courseId: z.string().uuid(),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  dayOfWeek: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomLabel: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

interface AccessScope {
  isSuperAdmin: boolean;
  academyId: string | null;
}

async function resolveScope(academyIdFromQuery?: string | null, requiredForWrite = false): Promise<AccessScope | NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

  if (isSuperAdmin) {
    const academyId = academyIdFromQuery?.trim() || "";

    if (requiredForWrite && !academyId) {
      return NextResponse.json({ message: "academyId is required for super admin requests." }, { status: 400 });
    }

    return { isSuperAdmin: true, academyId: academyId || null };
  }

  return { isSuperAdmin: false, academyId: session.academyId };
}

async function validateRelations(academyId: string, classroomId: string, courseId: string, teacherId?: string | null): Promise<string | null> {
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, academyId },
    select: { id: true },
  });

  if (!classroom) {
    return "Classroom not found.";
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, academyId },
    select: { id: true },
  });

  if (!course) {
    return "Subject not found.";
  }

  const subjectLink = await prisma.classroomCourse.findFirst({
    where: { academyId, classroomId, courseId },
    select: { id: true },
  });

  if (!subjectLink) {
    return "This subject is not linked to the selected classroom.";
  }

  if (teacherId) {
    const teacher = await prisma.teacherProfile.findFirst({
      where: { id: teacherId, academyId },
      select: { id: true },
    });

    if (!teacher) {
      return "Teacher not found.";
    }
  }

  return null;
}

type TimetableSlotWithRelations = Prisma.TimetableSlotGetPayload<{
  include: {
    academy: { select: { id: true; code: true; name: true } };
    classroom: { select: { id: true; code: true; name: true } };
    course: { select: { id: true; code: true; name: true } };
    teacher: {
      select: {
        id: true;
        teacherCode: true;
        user: { select: { fullName: true } };
      };
    };
  };
}>;

function mapSlot(slot: TimetableSlotWithRelations) {
  return {
    id: slot.id,
    academyId: slot.academyId,
    academyCode: slot.academy.code,
    academyName: slot.academy.name,
    classroomId: slot.classroomId,
    classroomCode: slot.classroom.code,
    classroomName: slot.classroom.name,
    courseId: slot.courseId,
    subjectCode: slot.course.code,
    subjectName: slot.course.name,
    teacherId: slot.teacherId,
    teacherName: slot.teacher?.user.fullName ?? null,
    teacherCode: slot.teacher?.teacherCode ?? null,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomLabel: slot.roomLabel,
    notes: slot.notes,
    isActive: slot.isActive,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const scope = await resolveScope(request.nextUrl.searchParams.get("academyId"));

  if (scope instanceof NextResponse) {
    return scope;
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId")?.trim() || undefined;
  const courseId = request.nextUrl.searchParams.get("courseId")?.trim() || undefined;

  const slots = await prisma.timetableSlot.findMany({
    where: {
      ...(scope.academyId ? { academyId: scope.academyId } : {}),
      ...(classroomId ? { classroomId } : {}),
      ...(courseId ? { courseId } : {}),
    },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
    include: {
      academy: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
      teacher: {
        select: {
          id: true,
          teacherCode: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });

  return NextResponse.json({ slots: slots.map(mapSlot) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = timetableSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const scope = await resolveScope(payload.academyId ?? null, true);

  if (scope instanceof NextResponse) {
    return scope;
  }

  if (!scope.academyId) {
    return NextResponse.json({ message: "academyId is required." }, { status: 400 });
  }

  if (!isValidTimeRange(payload.startTime, payload.endTime)) {
    return NextResponse.json({ message: "End time must be after start time." }, { status: 400 });
  }

  const relationError = await validateRelations(scope.academyId, payload.classroomId, payload.courseId, payload.teacherId || null);

  if (relationError) {
    return NextResponse.json({ message: relationError }, { status: 400 });
  }

  const slot = await prisma.timetableSlot.create({
    data: {
      academyId: scope.academyId,
      classroomId: payload.classroomId,
      courseId: payload.courseId,
      teacherId: payload.teacherId || null,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      roomLabel: payload.roomLabel?.trim() || null,
      notes: payload.notes?.trim() || null,
      isActive: payload.isActive ?? true,
    },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
      teacher: {
        select: {
          id: true,
          teacherCode: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });

  return NextResponse.json({ message: "Timetable slot created.", slot: mapSlot(slot) });
}