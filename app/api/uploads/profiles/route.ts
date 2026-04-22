import { UserRole } from "@prisma/client";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";

const blobAccess = process.env.BLOB_ACCESS === "public" ? "public" : "private";
const allowedEntities = new Set(["students", "parents"]);

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
    const entity = String(formData.get("entity") ?? "").trim().toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
    }

    if (!allowedEntities.has(entity)) {
      return NextResponse.json({ message: "Invalid upload entity." }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: "Only png, jpeg, webp, and gif images are allowed." }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ message: "Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to your environment variables." }, { status: 500 });
    }

    const blob = await put(`${entity}/${Date.now()}-${file.name}`, file, {
      access: blobAccess,
      addRandomSuffix: true,
    });

    const origin = new URL(request.url).origin;
    const displayUrl = blobAccess === "private"
      ? `${origin}/api/uploads/profiles/file?url=${encodeURIComponent(blob.url)}`
      : blob.url;

    return NextResponse.json({ message: "Uploaded successfully.", url: displayUrl, blobUrl: blob.url, access: blobAccess });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown Vercel Blob error.";
    return NextResponse.json({ message: `Failed to upload profile image. ${details}` }, { status: 500 });
  }
}
