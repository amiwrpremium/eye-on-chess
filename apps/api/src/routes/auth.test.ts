import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";
import jwt from "jsonwebtoken";

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock jwt helpers used inside the auth route.
// verifyAccessToken must still work for authMiddleware on protected routes.
vi.mock("../lib/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("mock-access-token"),
  verifyAccessToken: vi.fn((token: string) => {
    return jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      username: string;
      role: string;
    };
  }),
  generateRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
  hashToken: vi.fn().mockReturnValue("hashed-token"),
}));

import { authRoutes } from "./auth.js";
import bcrypt from "bcrypt";

describe("authRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(authRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /auth/register ─────────────────────────

  describe("POST /auth/register", () => {
    const validBody = {
      email: "new@example.com",
      username: "newuser",
      password: "password123",
      inviteCode: "valid-code",
    };

    it("registers successfully with valid data", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({
        id: "inv-1",
        code: "valid-code",
        usedById: null,
      });
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(null); // no existing email or username
      prisma.user.create.mockResolvedValue({
        id: "new-id",
        email: "new@example.com",
        username: "newuser",
        rating: 1200,
        role: "USER",
      });
      prisma.invite.update.mockResolvedValue({});
      prisma.collection.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: validBody,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBe("mock-access-token");
      expect(body.user.email).toBe("new@example.com");
    });

    it("returns 400 when fields are missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "a@b.com" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBeDefined();
    });

    it("returns 400 for invalid invite code", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: validBody,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/invalid invite/i);
    });

    it("returns 410 for already-used invite", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({
        id: "inv-1",
        code: "valid-code",
        usedById: "someone",
      });

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: validBody,
      });

      expect(res.statusCode).toBe(410);
      expect(JSON.parse(res.body).error).toMatch(/already been used/i);
    });

    it("returns 400 for short password", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({
        id: "inv-1",
        code: "valid-code",
        usedById: null,
      });
      prisma.user.count.mockResolvedValue(0);

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { ...validBody, password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/8 characters/i);
    });

    it("returns 409 for duplicate email", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({
        id: "inv-1",
        code: "valid-code",
        usedById: null,
      });
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValueOnce({ id: "existing" }); // existing email

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: validBody,
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toMatch(/email/i);
    });

    it("returns 409 for duplicate username", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({
        id: "inv-1",
        code: "valid-code",
        usedById: null,
      });
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no existing email
        .mockResolvedValueOnce({ id: "existing" }); // existing username

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: validBody,
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toMatch(/username/i);
    });
  });

  // ── POST /auth/login ────────────────────────────

  describe("POST /auth/login", () => {
    it("logs in successfully with valid credentials", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue(TEST_USER);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: TEST_USER.email, password: "validpassword" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBe("mock-access-token");
      expect(body.user.email).toBe(TEST_USER.email);
    });

    it("returns 400 when email or password missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "a@b.com" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 for non-existent user", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "nobody@example.com", password: "password123" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toMatch(/invalid credentials/i);
    });

    it("returns 401 for wrong password", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue(TEST_USER);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: TEST_USER.email, password: "wrongpassword" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toMatch(/invalid credentials/i);
    });

    it("returns 403 for inactive user", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ ...TEST_USER, active: false });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: TEST_USER.email, password: "password123" },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toMatch(/deactivated/i);
    });
  });

  // ── POST /auth/refresh ──────────────────────────

  describe("POST /auth/refresh", () => {
    it("refreshes token successfully", async () => {
      const prisma = getPrisma();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        token: "hashed-token",
        expiresAt: new Date(Date.now() + 86400000),
        user: TEST_USER,
      });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: "some-raw-token" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).accessToken).toBe("mock-access-token");
    });

    it("returns 401 when no refresh cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toMatch(/no refresh token/i);
    });

    it("returns 401 for expired refresh token", async () => {
      const prisma = getPrisma();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        token: "hashed-token",
        expiresAt: new Date(Date.now() - 86400000), // expired
        user: TEST_USER,
      });
      prisma.refreshToken.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: "some-raw-token" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toMatch(/invalid or expired/i);
    });
  });

  // ── GET /auth/me ────────────────────────────────

  describe("GET /auth/me", () => {
    it("returns current user when authenticated", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: TEST_USER.id,
        email: TEST_USER.email,
        username: TEST_USER.username,
        rating: TEST_USER.rating,
        avatarUrl: null,
        role: TEST_USER.role,
        tosAccepted: true,
        darkMode: true,
        boardTheme: "classic",
        pieceSet: "classic",
        soundEnabled: true,
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.id).toBe(TEST_USER.id);
      expect(body.user.email).toBe(TEST_USER.email);
    });

    it("returns 401 without auth header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/accept-tos ───────────────────────

  describe("POST /auth/accept-tos", () => {
    it("accepts TOS successfully", async () => {
      const prisma = getPrisma();
      prisma.user.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/accept-tos",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_USER.id },
          data: expect.objectContaining({ tosAccepted: true }),
        })
      );
    });
  });

  // ── POST /auth/logout ───────────────────────────

  describe("POST /auth/logout", () => {
    it("logs out successfully", async () => {
      const prisma = getPrisma();
      prisma.refreshToken.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
        cookies: { refresh_token: "some-token" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("logs out even without refresh cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  // ── PUT /auth/preferences ───────────────────────

  describe("PUT /auth/preferences", () => {
    it("updates preferences successfully", async () => {
      const prisma = getPrisma();
      prisma.user.update.mockResolvedValue({
        darkMode: false,
        boardTheme: "wood",
        pieceSet: "modern",
        soundEnabled: false,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/auth/preferences",
        headers: authHeader(),
        payload: { darkMode: false, boardTheme: "wood", pieceSet: "modern", soundEnabled: false },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.preferences.darkMode).toBe(false);
    });
  });

  // ── POST /auth/decline-tos ──────────────────────

  describe("POST /auth/decline-tos", () => {
    it("declines TOS and deactivates account", async () => {
      const prisma = getPrisma();
      prisma.user.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/auth/decline-tos",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/deactivated/i);
    });
  });
});
