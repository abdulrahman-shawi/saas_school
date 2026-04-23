import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

const createSubjectSchema = z.object({
  academyId: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  durationHours: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

interface AccessScope {
  isSuperAdmin: boolean;
  academyId: string | null;
}

function buildSubjectCode(count: number): string {
  return `SUB-${String(count + 1).padStart(3, "0")}`;
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const scope = await resolveScope(request.nextUrl.searchParams.get("academyId"));

  if (scope instanceof NextResponse) {
    return scope;
  }

  const subjects = await prisma.course.findMany({
    where: {
      ...(scope.academyId ? { academyId: scope.academyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
    },
  });

  return NextResponse.json({
    subjects: subjects.map((subject) => ({
      id: subject.id,
      academyId: subject.academyId,
      academyCode: subject.academy.code,
      academyName: subject.academy.name,
      code: subject.code,
      name: subject.name,
      description: subject.description,
      durationHours: subject.durationHours,
      status: subject.isActive ? "ACTIVE" : "INACTIVE",
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = createSubjectSchema.safeParse(await request.json());

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

  try {
    const subject = await prisma.$transaction(async (tx) => {
      const count = await tx.course.count({ where: { academyId: scope.academyId! } });

      return tx.course.create({
        data: {
          academyId: scope.academyId!,
          code: buildSubjectCode(count),
          name: payload.name.trim(),
          description: payload.description?.trim() || null,
          durationHours: payload.durationHours ?? null,
          isActive: payload.isActive ?? true,
        },
      });
    });

    return NextResponse.json({ message: "Subject created.", subject });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Subject code already exists in this academy."
      : "Failed to create subject.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
