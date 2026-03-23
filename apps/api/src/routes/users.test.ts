import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { getPrisma, authHeader, type FastifyInstance, createApp } from "../test/setup.js";

import { userRoutes } from "./users.js";

describe("userRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(userRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /users/search ───────────────────────────

  describe("GET /users/search", () => {
    it("returns matching users", async () => {
      const prisma = getPrisma();
      prisma.user.findMany.mockResolvedValue([
        { id: "u-1", username: "alice", rating: 1400, avatarUrl: null },
        { id: "u-2", username: "alicebot", rating: 1100, avatarUrl: null },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/users/search?q=alice",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.users).toHaveLength(2);
      expect(body.users[0].username).toBe("alice");
    });

    it("returns 400 when query is empty", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users/search?q=",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when query param missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users/search",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users/search?q=alice",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /users/:username ────────────────────────

  describe("GET /users/:username", () => {
    it("returns user profile with stats", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        username: "alice",
        rating: 1400,
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.game.count
        .mockResolvedValueOnce(10) // wins
        .mockResolvedValueOnce(5) // losses
        .mockResolvedValueOnce(3); // draws
      prisma.game.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/users/alice",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe("alice");
      expect(body.user.stats.wins).toBe(10);
      expect(body.user.stats.losses).toBe(5);
      expect(body.user.stats.draws).toBe(3);
      expect(body.user.stats.total).toBe(18);
      expect(body.user.isH2H).toBe(false);
    });

    it("returns 404 when user not found", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/users/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns H2H stats when vsUserId provided", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        username: "alice",
        rating: 1400,
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.game.count
        .mockResolvedValueOnce(3) // wins
        .mockResolvedValueOnce(2) // losses
        .mockResolvedValueOnce(1); // draws
      prisma.game.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/users/alice?vsUserId=u-2",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.isH2H).toBe(true);
      expect(body.user.stats.wins).toBe(3);
    });

    it("does not treat vsUserId=self as H2H", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        username: "alice",
        rating: 1400,
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.game.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5).mockResolvedValueOnce(3);
      prisma.game.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/users/alice?vsUserId=u-1",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.isH2H).toBe(false);
    });
  });
});
