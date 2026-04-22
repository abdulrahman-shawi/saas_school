import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { NextRequest, NextResponse } from "next/server";

const createMessageSchema = z.object({
  academyId: z.string().uuid().optional(),
  senderUserId: z.string().uuid(),
  receiverUserId: z.string().uuid(),
  subject: z.string().optional(),
  body: z.string().min(1),
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
  const academyId = isSuperAdmin ? academyIdQuery || undefined : session.academyId;

  const users = await prisma.user.findMany({
    where: {
      academyId,
      role: { in: [UserRole.ACADEMY_ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      role: true,
      username: true,
      status: true,
    },
  });

  const messages = await prisma.message.findMany({
    where: academyId ? { academyId } : {},
    orderBy: { createdAt: "desc" },
    include: {
      academy: { select: { id: true, code: true, name: true } },
      sender: { select: { id: true, fullName: true, role: true, username: true } },
      receiver: { select: { id: true, fullName: true, role: true, username: true } },
    },
  });

  return NextResponse.json({
    users,
    messages: messages.map((message) => ({
      id: message.id,
      academyId: message.academyId,
      academyCode: message.academy.code,
      academyName: message.academy.name,
      senderUserId: message.senderUserId,
      senderName: message.sender.fullName,
      senderRole: message.sender.role,
      receiverUserId: message.receiverUserId,
      receiverName: message.receiver.fullName,
      receiverRole: message.receiver.role,
      subject: message.subject,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = createMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const scope = await resolveScope(payload.academyId ?? null);

  if (scope instanceof NextResponse) {
    return scope;
  }

  if (payload.senderUserId === payload.receiverUserId) {
    return NextResponse.json({ message: "Sender and receiver must be different." }, { status: 400 });
  }

  const participants = await prisma.user.findMany({
    where: {
      academyId: scope.academyId,
      id: { in: [payload.senderUserId, payload.receiverUserId] },
    },
    select: { id: true },
  });

  if (participants.length !== 2) {
    return NextResponse.json({ message: "Sender or receiver not found in this academy." }, { status: 404 });
  }

  const message = await prisma.message.create({
    data: {
      academyId: scope.academyId,
      senderUserId: payload.senderUserId,
      receiverUserId: payload.receiverUserId,
      subject: payload.subject?.trim() || null,
      body: payload.body.trim(),
    },
  });

  return NextResponse.json({ message: "Message created.", data: message });
}
