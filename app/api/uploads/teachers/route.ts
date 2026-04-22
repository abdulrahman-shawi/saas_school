import { UserRole } from "@prisma/client";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";

/**
 * Uploads teacher profile image to Vercel Blob and returns public URL.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (session.role !== UserRole.ACADEMY_ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Only png, jpeg, webp, and gif images are allowed." },
        { status: 400 },
      );
    }

    const blob = await put(`teachers/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      message: "Uploaded successfully.",
      url: blob.url,
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to upload image. Configure Vercel Blob token first." },
      { status: 500 },
    );
  }
}
