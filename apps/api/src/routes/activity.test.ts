import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  getRedis,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

import { activityRoutes } from "./activity.js";

describe("activityRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(activityRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /feed ───────────────────────────────

  describe("GET /feed", () => {
    it("returns cached events when available", async () => {
      const redis = getRedis();
      const events = [
        {
          type: "game_won",
          message: "testuser beat opponent (RAPID)",
          timestamp: new Date().toISOString(),
        },
      ];
      redis.get.mockResolvedValue(JSON.stringify(events));

      const res = await app.inject({
        method: "GET",
        url: "/feed",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].type).toBe("game_won");
    });

    it("builds events from DB when no cache", async () => {
      const redis = getRedis();
      const prisma = getPrisma();

      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue("OK");

      // Friend IDs
      prisma.friendship.findMany.mockResolvedValue([
        { requesterId: TEST_USER.id, addresseeId: "friend-1" },
      ]);

      // Recent games
      prisma.game.findMany.mockResolvedValue([
        {
          id: "g-1",
          result: "WHITE_WIN",
          timeControl: "RAPID",
          isVsBot: false,
          botElo: null,
          endedAt: new Date(),
          whiteId: TEST_USER.id,
          blackId: "friend-1",
          white: { username: "testuser" },
          black: { username: "friend1" },
        },
      ]);

      // Recent analyses
      prisma.gameAnalysis.findMany.mockResolvedValue([]);

      // Recent friendships (reuse the second call for friend events)
      // Note: friendship.findMany is called twice — once for friend IDs, once for new friends
      prisma.friendship.findMany
        .mockResolvedValueOnce([{ requesterId: TEST_USER.id, addresseeId: "friend-1" }])
        .mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "GET",
        url: "/feed",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.events.length).toBeGreaterThanOrEqual(1);
      expect(body.events[0].type).toBe("game_won");
      expect(redis.setex).toHaveBeenCalled();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/feed",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns empty events when no data", async () => {
      const redis = getRedis();
      const prisma = getPrisma();

      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue("OK");

      prisma.friendship.findMany.mockResolvedValue([]);
      prisma.game.findMany.mockResolvedValue([]);
      prisma.gameAnalysis.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/feed",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).events).toHaveLength(0);
    });
  });
});
