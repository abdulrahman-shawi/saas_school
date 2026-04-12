import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

/**
 * Returns current authenticated user profile for client-side context.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ success: false, data: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, data: null }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      accountType: user.role,
      academyCode: session.academyCode,
      academyName: session.academyName,
    },
  });
}
