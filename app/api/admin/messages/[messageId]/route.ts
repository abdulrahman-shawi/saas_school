import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextResponse } from "next/server";

export async function DELETE(_request: Request, context: { params: { messageId: string } }): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const existing = await prisma.message.findUnique({
    where: { id: context.params.messageId },
    select: { id: true, academyId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Message not found." }, { status: 404 });
  }

  const isSuperAdmin = isSuperAdminAcademyCode(session.academyCode);

  if (!isSuperAdmin && existing.academyId !== session.academyId) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await prisma.message.delete({ where: { id: context.params.messageId } });
  return NextResponse.json({ message: "Message deleted." });
}
