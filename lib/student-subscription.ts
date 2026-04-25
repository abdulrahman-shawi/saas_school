import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getMonthLastDayUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function buildMonthlyAnchor(enrollmentDate: Date, year: number, month: number): Date {
  const day = Math.min(enrollmentDate.getUTCDate(), getMonthLastDayUtc(year, month));

  return new Date(Date.UTC(
    year,
    month,
    day,
    enrollmentDate.getUTCHours(),
    enrollmentDate.getUTCMinutes(),
    enrollmentDate.getUTCSeconds(),
    enrollmentDate.getUTCMilliseconds(),
  ));
}

export function getNextBillingDate(enrollmentDate: Date, referenceDate: Date): Date {
  let year = referenceDate.getUTCFullYear();
  let month = referenceDate.getUTCMonth();
  let candidate = buildMonthlyAnchor(enrollmentDate, year, month);

  while (candidate <= referenceDate) {
    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }

    candidate = buildMonthlyAnchor(enrollmentDate, year, month);
  }

  return candidate;
}

function getInitialAccessActiveUntil(enrollmentDate: Date, now: Date): Date {
  const referenceDate = now < enrollmentDate ? enrollmentDate : now;
  return getNextBillingDate(enrollmentDate, referenceDate);
}

export async function syncStudentSubscriptionByUserId(userId: string): Promise<UserStatus | null> {
  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      enrollmentDate: true,
      accessActiveUntil: true,
      user: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!student) {
    return null;
  }

  const now = new Date();

  if (!student.accessActiveUntil && student.user.status === UserStatus.ACTIVE) {
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        accessActiveUntil: getInitialAccessActiveUntil(student.enrollmentDate, now),
      },
    });

    return UserStatus.ACTIVE;
  }

  if (student.accessActiveUntil && student.accessActiveUntil <= now && student.user.status === UserStatus.ACTIVE) {
    await prisma.user.update({
      where: { id: student.user.id },
      data: { status: UserStatus.SUSPENDED },
    });

    return UserStatus.SUSPENDED;
  }

  return student.user.status;
}

export async function syncStudentSubscriptionsForAcademy(academyId: string): Promise<void> {
  const students = await prisma.studentProfile.findMany({
    where: { academyId },
    select: {
      id: true,
      enrollmentDate: true,
      accessActiveUntil: true,
      user: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const now = new Date();
  const updates = [] as Array<ReturnType<typeof prisma.studentProfile.update> | ReturnType<typeof prisma.user.update>>;

  for (const student of students) {
    if (!student.accessActiveUntil && student.user.status === UserStatus.ACTIVE) {
      updates.push(
        prisma.studentProfile.update({
          where: { id: student.id },
          data: {
            accessActiveUntil: getInitialAccessActiveUntil(student.enrollmentDate, now),
          },
        }),
      );
      continue;
    }

    if (student.accessActiveUntil && student.accessActiveUntil <= now && student.user.status === UserStatus.ACTIVE) {
      updates.push(
        prisma.user.update({
          where: { id: student.user.id },
          data: { status: UserStatus.SUSPENDED },
        }),
      );
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

export async function activateStudentForNextCycle(studentId: string, academyId: string) {
  const student = await prisma.studentProfile.findFirst({
    where: {
      id: studentId,
      academyId,
    },
    select: {
      id: true,
      userId: true,
      enrollmentDate: true,
      accessActiveUntil: true,
    },
  });

  if (!student) {
    return null;
  }

  const now = new Date();
  const referenceDate = student.accessActiveUntil && student.accessActiveUntil > now
    ? student.accessActiveUntil
    : now;
  const accessActiveUntil = getNextBillingDate(student.enrollmentDate, referenceDate);

  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        accessActiveUntil,
        lastActivatedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: student.userId },
      data: { status: UserStatus.ACTIVE },
    }),
  ]);

  return { accessActiveUntil };
}