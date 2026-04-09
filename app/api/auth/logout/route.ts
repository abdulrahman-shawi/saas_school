import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/jwt";

/**
 * Clears the JWT session cookie.
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ message: "Logged out successfully." });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
