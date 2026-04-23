import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const updateSubjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().or(z.literal("")),
  durationHours: z.number().int().positive().nullable().optional(),
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

export async function PATCH(request: Request, context: { params: { subjectId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = updateSubjectSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({
    where: { id: context.params.subjectId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Subject not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.course.update({
    where: { id: context.params.subjectId },
    data: {
      name: parsed.data.name?.trim(),
      description: parsed.data.description === "" ? null : parsed.data.description?.trim(),
      durationHours: parsed.data.durationHours,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ message: "Subject updated." });
}

export async function DELETE(_request: Request, context: { params: { subjectId: string } }): Promise<NextResponse> {
  const auth = await getAuthorizedSession();

  if (auth instanceof NextResponse) {
    return auth;
  }

  const existing = await prisma.course.findUnique({
    where: { id: context.params.subjectId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Subject not found." }, { status: 404 });
  }

  if (!auth.isSuperAdmin && existing.academyId !== auth.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.course.delete({ where: { id: context.params.subjectId } });
  return NextResponse.json({ message: "Subject deleted." });
}
