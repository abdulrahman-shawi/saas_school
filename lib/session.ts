import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SessionTokenPayload, verifySessionToken } from "@/lib/jwt";

/**
 * Returns the authenticated session payload from the HTTP-only session cookie.
 */
export async function getServerSession(): Promise<SessionTokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
