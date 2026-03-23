import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  getRedis,
  authHeader,
  ADMIN_USER,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

// Mock bcrypt for admin user creation
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { adminRoutes } from "./admin.js";

describe("adminRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(adminRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.resetAllMocks();
    // adminMiddleware checks the user in DB
    getPrisma().user.findUnique.mockResolvedValue({
      id: ADMIN_USER.id,
      role: "ADMIN",
      active: true,
    });
  });

  function adminHeaders() {
    return {
      ...authHeader(ADMIN_USER),
      "x-csrf-token": "test-csrf",
      cookie: "csrf_token=test-csrf",
    };
  }

  // ── GET /admin/csrf ─────────────────────────────

  describe("GET /admin/csrf", () => {
    it("returns a CSRF token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/csrf",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).token).toBeDefined();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/csrf",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      getPrisma().user.findUnique.mockResolvedValue({
        id: TEST_USER.id,
        role: "USER",
        active: true,
      });

      const res = await app.inject({
        method: "GET",
        url: "/admin/csrf",
        headers: authHeader(TEST_USER),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── GET /admin/dashboard ────────────────────────

  describe("GET /admin/dashboard", () => {
    it("returns dashboard stats", async () => {
      const prisma = getPrisma();
      const redis = getRedis();

      // adminMiddleware lookup (first call)
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      prisma.user.count
        .mockResolvedValueOnce(50) // totalUsers
        .mockResolvedValueOnce(45); // activeUsers
      prisma.game.count
        .mockResolvedValueOnce(200) // totalGames
        .mockResolvedValueOnce(5) // activeGames
        .mockResolvedValueOnce(180) // completedGames
        .mockResolvedValueOnce(10); // gamesToday
      redis.llen.mockResolvedValue(3);
      prisma.siteSettings.findUnique.mockResolvedValue({
        id: "singleton",
        siteName: "EyeOnChess",
        registrationOpen: true,
      });

      const res = await app.inject({
        method: "GET",
        url: "/admin/dashboard",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.stats.totalUsers).toBe(50);
      expect(body.stats.totalGames).toBe(200);
      expect(body.stats.analysisQueueDepth).toBe(3);
    });
  });

  // ── GET /admin/users ────────────────────────────

  describe("GET /admin/users", () => {
    it("returns paginated user list", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.user.findMany.mockResolvedValue([
        {
          id: "u-1",
          email: "a@b.com",
          username: "alice",
          rating: 1200,
          role: "USER",
          active: true,
          verified: true,
          createdAt: new Date(),
        },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/admin/users",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.users).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  // ── PATCH /admin/users/:id ──────────────────────

  describe("PATCH /admin/users/:id", () => {
    it("updates a user", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true }); // admin check
      prisma.user.update.mockResolvedValue({
        id: "u-1",
        email: "a@b.com",
        username: "alice",
        role: "USER",
        active: false,
        verified: true,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const res = await app.inject({
        method: "PATCH",
        url: "/admin/users/u-1",
        headers: adminHeaders(),
        payload: { active: false },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.active).toBe(false);
    });

    it("returns 400 when admin tries to demote self", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      const res = await app.inject({
        method: "PATCH",
        url: `/admin/users/${ADMIN_USER.id}`,
        headers: adminHeaders(),
        payload: { role: "USER" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/demote yourself/i);
    });

    it("returns 400 when admin tries to deactivate self", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      const res = await app.inject({
        method: "PATCH",
        url: `/admin/users/${ADMIN_USER.id}`,
        headers: adminHeaders(),
        payload: { active: false },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/deactivate yourself/i);
    });

    it("returns 400 when removing last admin", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true }) // admin middleware
        .mockResolvedValueOnce({ role: "ADMIN" }); // target user
      prisma.user.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "PATCH",
        url: "/admin/users/other-admin",
        headers: adminHeaders(),
        payload: { role: "USER" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/last admin/i);
    });
  });

  // ── DELETE /admin/users/:id ─────────────────────

  describe("DELETE /admin/users/:id", () => {
    it("deletes a user", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true }) // admin middleware
        .mockResolvedValueOnce({ role: "USER", username: "alice" }); // target
      prisma.user.delete.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/admin/users/u-1",
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 400 when admin tries to delete self", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      const res = await app.inject({
        method: "DELETE",
        url: `/admin/users/${ADMIN_USER.id}`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/yourself/i);
    });

    it("returns 404 when user not found", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true }) // admin middleware
        .mockResolvedValueOnce(null); // target

      const res = await app.inject({
        method: "DELETE",
        url: "/admin/users/nonexistent",
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when deleting last admin", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true }) // admin middleware
        .mockResolvedValueOnce({ role: "ADMIN", username: "otheradmin" }); // target
      prisma.user.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "DELETE",
        url: "/admin/users/other-admin",
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/last admin/i);
    });
  });

  // ── POST /admin/users ───────────────────────────

  describe("POST /admin/users", () => {
    it("creates a new user", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true }) // admin middleware
        .mockResolvedValueOnce(null) // no existing email
        .mockResolvedValueOnce(null); // no existing username
      prisma.user.create.mockResolvedValue({
        id: "u-new",
        email: "new@example.com",
        username: "newuser",
        role: "USER",
        verified: true,
      });
      prisma.collection.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers: adminHeaders(),
        payload: { email: "new@example.com", username: "newuser", password: "password123" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe("newuser");
    });

    it("returns 400 for missing fields", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      const res = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers: adminHeaders(),
        payload: { email: "a@b.com" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for short password", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });

      const res = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers: adminHeaders(),
        payload: { email: "a@b.com", username: "test", password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBeDefined();
    });

    it("returns 409 for duplicate email", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: "ADMIN", active: true })
        .mockResolvedValueOnce({ id: "existing" }); // existing email

      const res = await app.inject({
        method: "POST",
        url: "/admin/users",
        headers: adminHeaders(),
        payload: { email: "dup@example.com", username: "newuser", password: "password123" },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // ── GET /admin/games ────────────────────────────

  describe("GET /admin/games", () => {
    it("returns paginated game list", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.game.findMany.mockResolvedValue([
        {
          id: "g-1",
          status: "COMPLETED",
          result: "WHITE_WIN",
          timeControl: "RAPID",
          createdAt: new Date(),
          white: { username: "testuser" },
          black: { username: "opponent" },
        },
      ]);
      prisma.game.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/admin/games",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.games).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  // ── DELETE /admin/games/:id ─────────────────────

  describe("DELETE /admin/games/:id", () => {
    it("deletes a game", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.game.findUnique.mockResolvedValue({ id: "g-1" });
      prisma.game.delete.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/admin/games/g-1",
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/admin/games/nonexistent",
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /admin/settings ─────────────────────────

  describe("GET /admin/settings", () => {
    it("returns existing settings", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.siteSettings.findUnique.mockResolvedValue({
        id: "singleton",
        siteName: "EyeOnChess",
        registrationOpen: true,
        maxUsers: 0,
        requireEmailVerification: false,
      });

      const res = await app.inject({
        method: "GET",
        url: "/admin/settings",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).settings.siteName).toBe("EyeOnChess");
    });

    it.skip("creates default settings if none exist", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.siteSettings.findUnique.mockResolvedValue(null);
      prisma.siteSettings.create.mockResolvedValue({
        id: "singleton",
        siteName: "EyeOnChess",
        registrationOpen: true,
        maxUsers: 0,
        requireEmailVerification: false,
      });

      const res = await app.inject({
        method: "GET",
        url: "/admin/settings",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.siteSettings.create).toHaveBeenCalled();
    });
  });

  // ── PUT /admin/settings ─────────────────────────

  describe("PUT /admin/settings", () => {
    it("updates site settings", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.siteSettings.upsert.mockResolvedValue({
        id: "singleton",
        siteName: "Updated Name",
        registrationOpen: false,
        maxUsers: 100,
        requireEmailVerification: true,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const res = await app.inject({
        method: "PUT",
        url: "/admin/settings",
        headers: adminHeaders(),
        payload: {
          siteName: "Updated Name",
          registrationOpen: false,
          maxUsers: 100,
          requireEmailVerification: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).settings.siteName).toBe("Updated Name");
    });
  });

  // ── GET /admin/audit-log ────────────────────────

  describe("GET /admin/audit-log", () => {
    it("returns paginated audit logs", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", active: true });
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: "al-1",
          adminId: ADMIN_USER.id,
          action: "user.update",
          targetType: "user",
          targetId: "u-1",
          details: null,
          ip: "127.0.0.1",
          createdAt: new Date(),
          admin: { username: "admin" },
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/admin/audit-log",
        headers: authHeader(ADMIN_USER),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.logs).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });
});
