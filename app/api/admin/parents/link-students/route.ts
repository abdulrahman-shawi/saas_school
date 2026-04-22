import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

const linkStudentsSchema = z.object({
  parentId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1),
  relation: z.string().min(2).default("FATHER"),
  isPrimary: z.boolean().optional().default(true),
});

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const parsed = linkStudentsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const { parentId, studentIds, relation, isPrimary } = parsed.data;

  try {
    const parent = await prisma.parentProfile.findUnique({
      where: { id: parentId },
      select: { id: true, academyId: true },
    });

    if (!parent) {
      return NextResponse.json({ message: "Parent not found." }, { status: 404 });
    }

    const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

    if (!isSuperAdmin && parent.academyId !== session.academyId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const students = await prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        academyId: parent.academyId,
      },
      select: { id: true },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json({ message: "Some students do not belong to this academy." }, { status: 400 });
    }

    const existingLinks = await prisma.parentStudentLink.findMany({
      where: {
        parentId,
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    });

    const existingStudentIds = new Set(existingLinks.map((link) => link.studentId));
    const newStudentIds = studentIds.filter((studentId) => !existingStudentIds.has(studentId));

    if (newStudentIds.length > 0) {
      await prisma.parentStudentLink.createMany({
        data: newStudentIds.map((studentId) => ({
          academyId: parent.academyId,
          parentId,
          studentId,
          relation,
          isPrimary,
        })),
      });
    }

    return NextResponse.json({ message: "Students linked to parent.", count: newStudentIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link students.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
