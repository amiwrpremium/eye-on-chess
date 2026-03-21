import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../lib/jwt.js";
import { getSiteSettings } from "../lib/settings.js";
import { authMiddleware } from "../middleware/auth.js";

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

export async function authRoutes(app: FastifyInstance) {
  // ── Register ──────────────────────────────────────
  app.post<{
    Body: { email: string; username: string; password: string };
  }>("/api/auth/register", async (request, reply) => {
    const { email, username, password } = request.body;

    if (!email || !username || !password) {
      return reply.status(400).send({ error: "All fields are required" });
    }

    // Check registration flags from DB settings
    const siteSettings = await getSiteSettings();
    if (!siteSettings.registrationOpen) {
      return reply.status(403).send({ error: "Registration is currently closed" });
    }

    if (siteSettings.maxUsers > 0) {
      const userCount = await prisma.user.count();
      if (userCount >= siteSettings.maxUsers) {
        return reply.status(403).send({ error: "Maximum user limit reached" });
      }
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return reply.status(409).send({ error: "Email already in use" });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return reply.status(409).send({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
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
  }>("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.active) {
      return reply.status(403).send({ error: "Account is deactivated" });
    }

    const loginSettings = await getSiteSettings();
    if (loginSettings.requireEmailVerification && !user.verified) {
      return reply.status(403).send({ error: "Email not verified" });
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
  app.post("/api/auth/refresh", async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      return reply.status(401).send({ error: "No refresh token" });
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
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate: delete old, create new (handle concurrent requests gracefully)
    const deleted = await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
    if (deleted.count === 0) {
      // Another concurrent request already rotated this token
      return reply.status(401).send({ error: "Token already used" });
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
  app.post("/api/auth/logout", async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (rawToken) {
      const hashed = hashToken(rawToken);
      await prisma.refreshToken.delete({ where: { token: hashed } }).catch(() => {});
    }

    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { success: true };
  });

  // ── Me ────────────────────────────────────────────
  app.get("/api/auth/me", { preHandler: authMiddleware }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        rating: true,
        avatarUrl: true,
        role: true,
        darkMode: true,
        boardTheme: true,
        pieceSet: true,
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
    Body: { darkMode?: boolean; boardTheme?: string; pieceSet?: string };
  }>("/api/auth/preferences", { preHandler: authMiddleware }, async (request) => {
    const { darkMode, boardTheme, pieceSet } = request.body;

    const VALID_BOARD_THEMES = ["classic", "wood", "green", "blue", "purple", "dark"];
    const VALID_PIECE_SETS = ["classic", "modern", "minimal"];

    const data: Record<string, unknown> = {};
    if (darkMode !== undefined) data.darkMode = darkMode;
    if (boardTheme && VALID_BOARD_THEMES.includes(boardTheme)) data.boardTheme = boardTheme;
    if (pieceSet && VALID_PIECE_SETS.includes(pieceSet)) data.pieceSet = pieceSet;

    const user = await prisma.user.update({
      where: { id: request.user.userId },
      data,
      select: {
        darkMode: true,
        boardTheme: true,
        pieceSet: true,
      },
    });

    return { preferences: user };
  });
}
