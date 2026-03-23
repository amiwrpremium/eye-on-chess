import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  getRedis,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

// Mock statsCompute helpers
vi.mock("../lib/statsCompute.js", () => ({
  computeRecord: vi.fn().mockReturnValue({ wins: 5, losses: 3, draws: 2 }),
  computeRatingHistory: vi.fn().mockReturnValue([{ date: "2025-01-01", rating: 1200 }]),
  computeOpeningStats: vi.fn().mockReturnValue([]),
  computeStreaks: vi
    .fn()
    .mockReturnValue({ currentWin: 2, bestWin: 5, currentLoss: 0, bestLoss: 3 }),
  computeActivity: vi.fn().mockReturnValue([]),
}));

import { statsRoutes } from "./stats.js";

describe("statsRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(statsRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /stats ──────────────────────────────────

  describe("GET /stats", () => {
    it("returns cached stats when available", async () => {
      const redis = getRedis();
      const cachedData = {
        rating: { current: 1250, history: [] },
        record: { wins: 5, losses: 3, draws: 2 },
        openings: [],
        accuracy: { average: null, best: null, worst: null, gamesAnalyzed: 0 },
        streaks: { currentWin: 2, bestWin: 5, currentLoss: 0, bestLoss: 3 },
        activity: [],
        totalGames: 10,
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedData));

      const res = await app.inject({
        method: "GET",
        url: "/stats",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.record.wins).toBe(5);
      expect(body.totalGames).toBe(10);
    });

    it("computes stats from DB when no cache", async () => {
      const redis = getRedis();
      const prisma = getPrisma();

      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue("OK");

      prisma.user.findUnique.mockResolvedValue({ rating: 1200 });
      prisma.game.findMany.mockResolvedValue([]);
      prisma.gameAnalysis.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/stats",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.rating.current).toBe(1200);
      expect(body.record).toEqual({ wins: 5, losses: 3, draws: 2 });
      expect(body.accuracy.gamesAnalyzed).toBe(0);
      expect(redis.setex).toHaveBeenCalled();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/stats",
      });

      expect(res.statusCode).toBe(401);
    });

    it("computes accuracy stats when analyses exist", async () => {
      const redis = getRedis();
      const prisma = getPrisma();

      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue("OK");

      prisma.user.findUnique.mockResolvedValue({ rating: 1300 });
      prisma.game.findMany.mockResolvedValue([]);
      prisma.gameAnalysis.findMany.mockResolvedValue([
        {
          gameId: "g-1",
          whiteAccuracy: 85.5,
          blackAccuracy: 72.3,
          game: { whiteId: TEST_USER.id },
        },
        {
          gameId: "g-2",
          whiteAccuracy: 60.0,
          blackAccuracy: 90.2,
          game: { whiteId: "other" },
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/stats",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accuracy.gamesAnalyzed).toBe(2);
      expect(body.accuracy.average).toBeDefined();
      expect(body.accuracy.best).toBeDefined();
      expect(body.accuracy.worst).toBeDefined();
    });
  });
});
