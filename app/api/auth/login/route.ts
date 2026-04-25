import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncStudentSubscriptionByUserId } from "@/lib/student-subscription";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/jwt";

const loginSchema = z.object({
  academyCode: z.string().min(2),
  username: z.string().min(2),
  password: z.string().min(6),
});

/**
 * Authenticates a tenant user and issues an HTTP-only JWT session cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid login payload." },
      { status: 400 },
    );
  }

  const academyCode = parsed.data.academyCode.trim();
  const username = parsed.data.username.trim();
  const password = parsed.data.password;

  const academy = await prisma.academy.findFirst({
    where: {
      code: {
        equals: academyCode,
        mode: "insensitive",
      },
    },
  });

  if (!academy || !academy.isActive) {
    return NextResponse.json(
      { message: "Invalid credentials." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      academyId_username: {
        academyId: academy.id,
        username,
      },
    },
  });

  const resolvedStatus = user?.role === "STUDENT"
    ? await syncStudentSubscriptionByUserId(user.id)
    : user?.status;

  if (!user || resolvedStatus !== "ACTIVE") {
    return NextResponse.json(
      { message: "Invalid credentials." },
      { status: 401 },
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return NextResponse.json(
      { message: "Invalid credentials." },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    academyId: academy.id,
    academyCode: academy.code,
    academyName: academy.name,
    role: user.role,
    username: user.username,
    fullName: user.fullName,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const response = NextResponse.json({
    message: "Logged in successfully.",
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      username: user.username,
    },
    academy: {
      id: academy.id,
      code: academy.code,
      name: academy.name,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return response;
}
