import { JWTPayload } from "jose";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE_NAME = "academy_session";

export interface SessionTokenPayload extends JWTPayload {
  sub: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  role: string;
  username: string;
  fullName: string;
}

/**
 * Returns the signing secret for JWT tokens.
 */
function getJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }

  return new TextEncoder().encode(jwtSecret);
}

/**
 * Creates a signed JWT session token.
 */
export async function createSessionToken(
  payload: SessionTokenPayload,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

/**
 * Verifies a JWT session token and returns its payload.
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as SessionTokenPayload;
  } catch {
    return null;
  }
}
