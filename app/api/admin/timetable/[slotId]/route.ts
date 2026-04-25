import { UserRole, Weekday } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { isValidTimeRange } from "@/lib/timetable";
import { NextResponse } from "next/server";

const updateTimetableSchema = z.object({
  classroomId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  dayOfWeek: z.nativeEnum(Weekday).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  roomLabel: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
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

async function validateRelations(academyId: string, classroomId: string, courseId: string, teacherId?: string | null): Promise<string | null> {
  const link = await prisma.classroomCourse.findFirst({
    where: { academyId, classroomId, courseId },
    select: { id: true },
  });

  if (!link) {
    return "This subject is not linked to the selected classroom.";
  }

  if (teacherId) {
    const teacher = await prisma.teacherProfile.findFirst({
      where: { academyId, id: teacherId },
      select: { id: true },
    });

    if (!teacher) {
      return "Teacher not found.";
    }
  }

  return null;
}

export async function PATCH(request: Request, context: { params: { slotId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = updateTimetableSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const existing = await prisma.timetableSlot.findUnique({
    where: { id: context.params.slotId },
    select: {
      id: true,
      academyId: true,
      classroomId: true,
      courseId: true,
      teacherId: true,
      startTime: true,
      endTime: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Timetable slot not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const classroomId = parsed.data.classroomId ?? existing.classroomId;
  const courseId = parsed.data.courseId ?? existing.courseId;
  const teacherId = parsed.data.teacherId === "" ? null : (parsed.data.teacherId ?? existing.teacherId);
  const startTime = parsed.data.startTime ?? existing.startTime;
  const endTime = parsed.data.endTime ?? existing.endTime;

  if (!isValidTimeRange(startTime, endTime)) {
    return NextResponse.json({ message: "End time must be after start time." }, { status: 400 });
  }

  const relationError = await validateRelations(existing.academyId, classroomId, courseId, teacherId);

  if (relationError) {
    return NextResponse.json({ message: relationError }, { status: 400 });
  }

  await prisma.timetableSlot.update({
    where: { id: existing.id },
    data: {
      classroomId,
      courseId,
      teacherId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      roomLabel: parsed.data.roomLabel === "" ? null : parsed.data.roomLabel?.trim(),
      notes: parsed.data.notes === "" ? null : parsed.data.notes?.trim(),
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ message: "Timetable slot updated." });
}

export async function DELETE(_request: Request, context: { params: { slotId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.timetableSlot.findUnique({
    where: { id: context.params.slotId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Timetable slot not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.timetableSlot.delete({ where: { id: existing.id } });
  return NextResponse.json({ message: "Timetable slot deleted." });
}