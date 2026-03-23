import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { getPrisma, authHeader, type FastifyInstance, createApp } from "../test/setup.js";

import { inviteRoutes } from "./invites.js";

describe("inviteRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(inviteRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /invites/validate/:code ─────────────────

  describe("GET /invites/validate/:code", () => {
    it("returns valid for unused invite", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({ id: "inv-1", usedById: null });

      const res = await app.inject({
        method: "GET",
        url: "/invites/validate/abc123",
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).valid).toBe(true);
    });

    it("returns 404 for non-existent invite", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/invites/validate/nonexistent",
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).valid).toBe(false);
    });

    it("returns 410 for already-used invite", async () => {
      const prisma = getPrisma();
      prisma.invite.findUnique.mockResolvedValue({ id: "inv-1", usedById: "someone" });

      const res = await app.inject({
        method: "GET",
        url: "/invites/validate/used-code",
      });

      expect(res.statusCode).toBe(410);
      expect(JSON.parse(res.body).valid).toBe(false);
    });
  });

  // ── GET /invites/stats ──────────────────────────

  describe("GET /invites/stats", () => {
    it("returns invite stats", async () => {
      const prisma = getPrisma();
      prisma.invite.count
        .mockResolvedValueOnce(5) // totalCreated
        .mockResolvedValueOnce(3); // totalUsed

      const res = await app.inject({
        method: "GET",
        url: "/invites/stats",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalCreated).toBe(5);
      expect(body.totalUsed).toBe(3);
      expect(body).toHaveProperty("maxAllowed");
      expect(body).toHaveProperty("remaining");
      expect(body).toHaveProperty("canCreate");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/invites/stats",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /invites ────────────────────────────────

  describe("GET /invites", () => {
    it("returns list of user invites", async () => {
      const prisma = getPrisma();
      prisma.invite.findMany.mockResolvedValue([
        {
          id: "inv-1",
          code: "abc-123",
          usedById: null,
          usedAt: null,
          createdAt: new Date(),
          usedBy: null,
        },
        {
          id: "inv-2",
          code: "def-456",
          usedById: "user-2",
          usedAt: new Date(),
          createdAt: new Date(),
          usedBy: { username: "newuser" },
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/invites",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.invites).toHaveLength(2);
      expect(body.invites[0].used).toBe(false);
      expect(body.invites[1].used).toBe(true);
      expect(body.invites[1].usedBy).toBe("newuser");
    });
  });

  // ── POST /invites ───────────────────────────────

  describe("POST /invites", () => {
    it("generates a new invite code", async () => {
      const prisma = getPrisma();
      prisma.invite.count
        .mockResolvedValueOnce(3) // totalCreated
        .mockResolvedValueOnce(0); // totalUsed
      prisma.invite.create.mockResolvedValue({
        code: "new-invite-code",
      });

      const res = await app.inject({
        method: "POST",
        url: "/invites",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("new-invite-code");
    });

    it("returns 403 when invite limit reached", async () => {
      const prisma = getPrisma();
      prisma.invite.count
        .mockResolvedValueOnce(10) // totalCreated = max for batch 1
        .mockResolvedValueOnce(0); // totalUsed = 0 (not enough for next batch)

      const res = await app.inject({
        method: "POST",
        url: "/invites",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toMatch(/limit/i);
    });
  });
});
