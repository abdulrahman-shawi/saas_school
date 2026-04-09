import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns academy metadata by academy code to help users confirm the correct tenant before login.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const academyCode = request.nextUrl.searchParams.get("code")?.trim();

  if (!academyCode) {
    return NextResponse.json(
      { message: "Academy code is required." },
      { status: 400 },
    );
  }

  const academy = await prisma.academy.findFirst({
    where: {
      code: {
        equals: academyCode,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  });

  if (!academy) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    id: academy.id,
    code: academy.code,
    name: academy.name,
    isActive: academy.isActive,
  });
}
