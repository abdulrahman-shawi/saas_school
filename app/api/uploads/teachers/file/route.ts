import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";

/**
 * Streams a teacher image from a private Vercel Blob store through the app domain.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        message:
          "Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to your environment variables.",
      },
      { status: 500 },
    );
  }

  const blobUrl = new URL(request.url).searchParams.get("url");

  if (!blobUrl) {
    return NextResponse.json({ message: "Blob url is required." }, { status: 400 });
  }

  try {
    const result = await get(blobUrl, {
      access: "private",
      useCache: true,
    });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ message: "Image not found." }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": result.blob.cacheControl,
        "Content-Disposition": result.blob.contentDisposition,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown Vercel Blob error.";

    console.error("Teacher image proxy failed:", details);

    return NextResponse.json(
      { message: `Failed to load image from Vercel Blob. ${details}` },
      { status: 500 },
    );
  }
}