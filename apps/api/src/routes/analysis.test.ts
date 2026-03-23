import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  getRedis,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

// Mock eco lookup
vi.mock("../lib/eco.js", () => ({
  lookupOpening: vi.fn().mockReturnValue({ eco: "C50", name: "Italian Game" }),
}));

import { analysisRoutes } from "./analysis.js";

describe("analysisRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(analysisRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    // Add rpush mock since the setup doesn't include it
    const redis = getRedis();
    (redis as Record<string, unknown>).rpush = vi.fn().mockResolvedValue(1);
  });

  // ── POST /games/:id/analyze ─────────────────────

  describe("POST /games/:id/analyze", () => {
    it("queues analysis for a completed game", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      prisma.game.findUnique.mockResolvedValue({
        status: "COMPLETED",
        whiteId: TEST_USER.id,
        blackId: "other",
      });
      redis.get.mockResolvedValue(null); // no existing status
      redis.set.mockResolvedValue("OK");

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("queued");
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/nonexistent/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when game not completed", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        status: "ACTIVE",
        whiteId: TEST_USER.id,
        blackId: "other",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/completed/i);
    });

    it("returns 403 when not a player", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        status: "COMPLETED",
        whiteId: "other1",
        blackId: "other2",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns existing status if already queued", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      prisma.game.findUnique.mockResolvedValue({
        status: "COMPLETED",
        whiteId: TEST_USER.id,
        blackId: "other",
      });
      redis.get.mockResolvedValue("queued");

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("queued");
      expect(body.message).toMatch(/already/i);
    });

    it("returns existing status if processing", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      prisma.game.findUnique.mockResolvedValue({
        status: "COMPLETED",
        whiteId: TEST_USER.id,
        blackId: "other",
      });
      redis.get.mockResolvedValue("processing");

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe("processing");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/analyze",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /games/:id/analysis ─────────────────────

  describe("GET /games/:id/analysis", () => {
    it("returns analysis results when available", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      redis.get.mockResolvedValue("done");
      prisma.gameAnalysis.findUnique.mockResolvedValue({
        id: "a-1",
        gameId: "g-1",
        whiteAccuracy: 85.5,
        blackAccuracy: 72.3,
        feedback: [
          {
            ply: 1,
            classification: "BEST",
            bestMove: "e2e4",
            evalBefore: 0.2,
            evalAfter: 0.3,
            move: { ply: 1, san: "e4", uci: "e2e4", fen: "some-fen" },
          },
        ],
      });
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        moves: [{ san: "e4" }, { san: "e5" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/analysis",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("done");
      expect(body.analysis).toBeDefined();
      expect(body.analysis.whiteAccuracy).toBe(85.5);
      expect(body.analysis.opening).toEqual({ eco: "C50", name: "Italian Game" });
      expect(body.analysis.feedback).toHaveLength(1);
    });

    it("returns status none when no analysis exists", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      redis.get.mockResolvedValue(null);
      prisma.gameAnalysis.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/analysis",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("none");
      expect(body.analysis).toBeNull();
    });

    it("returns queued status when analysis is pending", async () => {
      const prisma = getPrisma();
      const redis = getRedis();
      redis.get.mockResolvedValue("queued");
      prisma.gameAnalysis.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/analysis",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("queued");
      expect(body.analysis).toBeNull();
    });
  });
});
