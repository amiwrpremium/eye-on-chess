import jwt, { type Secret } from "jsonwebtoken";
import crypto from "crypto";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET: Secret = process.env.JWT_SECRET;

/** Payload encoded within a JWT access token. */
export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Sign a JWT access token with a 15-minute expiry.
 * @param payload - The user data to embed in the token.
 * @returns The signed JWT string.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ ...payload }, JWT_SECRET, { expiresIn: "15m" });
}

/**
 * Verify and decode a JWT access token.
 * @param token - The JWT string to verify.
 * @returns The decoded payload.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as unknown as AccessTokenPayload;
}

/**
 * Generate a cryptographically random refresh token.
 * @returns A hex-encoded random string.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * SHA-256 hash a token for secure storage.
 * @param token - The raw token string.
 * @returns The hex-encoded hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
