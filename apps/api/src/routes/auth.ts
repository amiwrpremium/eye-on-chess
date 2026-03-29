import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../lib/jwt.js";
import { getSiteSettings } from "../lib/settings.js";
import { authMiddleware } from "../middleware/auth.js";
import { sanitizeString } from "../middleware/admin.js";
import { registerBodySchema, loginBodySchema, preferencesBodySchema } from "../lib/schemas.js";
import {
  apiError,
  AUTH_INVALID_INVITE,
  AUTH_INVITE_USED,
  AUTH_REGISTRATION_CLOSED,
  AUTH_MAX_USERS,
  AUTH_EMAIL_EXISTS,
  AUTH_USERNAME_EXISTS,
  AUTH_INVALID_CREDENTIALS,
  AUTH_ACCOUNT_DEACTIVATED,
  AUTH_EMAIL_NOT_VERIFIED,
  AUTH_NO_REFRESH_TOKEN,
  AUTH_INVALID_REFRESH_TOKEN,
  AUTH_TOKEN_USED,
} from "../lib/errorCodes.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const BCRYPT_ROUNDS = 12;
const COOKIE_NAME = "refresh_token";

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

async function createTokens(user: { id: string; email: string; username: string; role: string }) {
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, rawRefreshToken };
}

/** Register authentication routes (register, login, refresh, logout). */
export async function authRoutes(app: FastifyInstance) {
  // ── Register ──────────────────────────────────────
  app.post<{
    Body: { email: string; username: string; password: string; inviteCode: string };
  }>("/auth/register", { schema: { body: registerBodySchema } }, async (request, reply) => {
    const { email, password, inviteCode } = request.body;
    const username = sanitizeString(request.body.username);

    // Validate invite code
    const invite = await prisma.invite.findUnique({ where: { code: inviteCode } });
    if (!invite) {
      return apiError(reply, 400, AUTH_INVALID_INVITE, "Invalid invite code");
    }
    if (invite.usedById) {
      return apiError(reply, 410, AUTH_INVITE_USED, "Invite code has already been used");
    }

    // Check registration flags from DB settings
    const siteSettings = await getSiteSettings();
    if (!siteSettings.registrationOpen) {
      return apiError(reply, 403, AUTH_REGISTRATION_CLOSED, "Registration is currently closed");
    }

    if (siteSettings.maxUsers > 0) {
      const userCount = await prisma.user.count();
      if (userCount >= siteSettings.maxUsers) {
        return apiError(reply, 403, AUTH_MAX_USERS, "Maximum user limit reached");
      }
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return apiError(reply, 409, AUTH_EMAIL_EXISTS, "Email already in use");
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return apiError(reply, 409, AUTH_USERNAME_EXISTS, "Username already taken");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    // Mark invite as used
    await prisma.invite.update({
      where: { code: inviteCode },
      data: { usedById: user.id, usedAt: new Date() },
    });

    // Auto-create Favorites collection
    await prisma.collection.create({
      data: { userId: user.id, name: "Favorites" },
    });

    const { accessToken, rawRefreshToken } = await createTokens(user);

    reply.setCookie(
      COOKIE_NAME,
      rawRefreshToken,
      cookieOptions(REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rating: user.rating,
        role: user.role,
      },
    };
  });

  // ── Login ─────────────────────────────────────────
  app.post<{
    Body: { email: string; password: string };
  }>("/auth/login", { schema: { body: loginBodySchema } }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return apiError(reply, 401, AUTH_INVALID_CREDENTIALS, "Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return apiError(reply, 401, AUTH_INVALID_CREDENTIALS, "Invalid credentials");
    }

    if (!user.active) {
      return apiError(reply, 403, AUTH_ACCOUNT_DEACTIVATED, "Account is deactivated");
    }

    const loginSettings = await getSiteSettings();
    if (loginSettings.requireEmailVerification && !user.verified) {
      return apiError(reply, 403, AUTH_EMAIL_NOT_VERIFIED, "Email not verified");
    }

    const { accessToken, rawRefreshToken } = await createTokens(user);

    reply.setCookie(
      COOKIE_NAME,
      rawRefreshToken,
      cookieOptions(REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rating: user.rating,
        role: user.role,
      },
    };
  });

  // ── Refresh ───────────────────────────────────────
  app.post("/auth/refresh", async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      return apiError(reply, 401, AUTH_NO_REFRESH_TOKEN, "No refresh token");
    }

    const hashed = hashToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { token: hashed },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      reply.clearCookie(COOKIE_NAME, { path: "/" });
      return apiError(reply, 401, AUTH_INVALID_REFRESH_TOKEN, "Invalid or expired refresh token");
    }

    // Rotate: delete old, create new (handle concurrent requests gracefully)
    const deleted = await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
    if (deleted.count === 0) {
      // Another concurrent request already rotated this token
      return apiError(reply, 401, AUTH_TOKEN_USED, "Token already used");
    }

    const { accessToken, rawRefreshToken } = await createTokens(stored.user);

    reply.setCookie(
      COOKIE_NAME,
      rawRefreshToken,
      cookieOptions(REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    );

    return { accessToken };
  });

  // ── Logout ────────────────────────────────────────
  app.post("/auth/logout", async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (rawToken) {
      const hashed = hashToken(rawToken);
      await prisma.refreshToken
        .delete({ where: { token: hashed } })
        .catch((err) => logger.warn({ err }, "failed to delete refresh token on logout"));
    }

    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { success: true };
  });

  // ── Me ────────────────────────────────────────────
  app.get("/auth/me", { preHandler: authMiddleware }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        rating: true,
        avatarUrl: true,
        role: true,
        tosAccepted: true,
        darkMode: true,
        boardTheme: true,
        pieceSet: true,
        soundEnabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw { statusCode: 404, message: "User not found" };
    }

    return { user };
  });

  // ── Update preferences ──────────────────────────────
  app.put<{
    Body: { darkMode?: boolean; boardTheme?: string; pieceSet?: string; soundEnabled?: boolean };
  }>(
    "/auth/preferences",
    { schema: { body: preferencesBodySchema }, preHandler: authMiddleware },
    async (request) => {
      const { darkMode, boardTheme, pieceSet, soundEnabled } = request.body;

      const VALID_BOARD_THEMES = ["classic", "wood", "green", "blue", "purple", "dark"];
      const VALID_PIECE_SETS = ["classic", "modern", "minimal"];

      const data: Record<string, unknown> = {};
      if (darkMode !== undefined) data.darkMode = darkMode;
      if (boardTheme && VALID_BOARD_THEMES.includes(boardTheme)) data.boardTheme = boardTheme;
      if (pieceSet && VALID_PIECE_SETS.includes(pieceSet)) data.pieceSet = pieceSet;
      if (soundEnabled !== undefined) data.soundEnabled = soundEnabled;

      const user = await prisma.user.update({
        where: { id: request.user.userId },
        data,
        select: {
          darkMode: true,
          boardTheme: true,
          pieceSet: true,
          soundEnabled: true,
        },
      });

      return { preferences: user };
    }
  );

  // ── Accept TOS ──────────────────────────────────────
  app.post("/auth/accept-tos", { preHandler: authMiddleware }, async (request) => {
    await prisma.user.update({
      where: { id: request.user.userId },
      data: { tosAccepted: true, tosAcceptedAt: new Date() },
    });
    return { success: true };
  });

  // ── Decline TOS ─────────────────────────────────────
  app.post("/auth/decline-tos", { preHandler: authMiddleware }, async (request) => {
    // Record the decline but deactivate the account
    await prisma.user.update({
      where: { id: request.user.userId },
      data: { tosAccepted: false, active: false },
    });
    return { success: true, message: "Account deactivated" };
  });
}
