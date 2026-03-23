import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { createApp, getPrisma, type FastifyInstance } from "../test/setup.js";
import { botRoutes } from "./bots.js";

const MOCK_BOTS = [
  {
    id: "1",
    botId: "amir",
    name: "Amir",
    elo: 200,
    description: "Test bot",
    avatar: "T",
    tier: "custom",
    category: "beginner",
    enabled: true,
    randomMoveChance: 0.45,
    blunderChance: 0.3,
    captureGreed: 0.2,
    aggressionBias: 0,
    maxDepth: 1,
    queenEarly: false,
    pawnPusher: true,
    sortOrder: 0,
  },
];

describe("botRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(botRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /bots", () => {
    it("returns 200 with bots from database", async () => {
      getPrisma().botProfile.findMany.mockResolvedValue(MOCK_BOTS);

      const res = await app.inject({ method: "GET", url: "/bots" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.bots)).toBe(true);
      expect(body.bots.length).toBe(1);
      expect(body.bots[0].id).toBe("amir");
    });

    it("has correct structure", async () => {
      getPrisma().botProfile.findMany.mockResolvedValue(MOCK_BOTS);

      const res = await app.inject({ method: "GET", url: "/bots" });
      const body = JSON.parse(res.body);
      const bot = body.bots[0];
      expect(bot).toHaveProperty("id");
      expect(bot).toHaveProperty("name");
      expect(bot).toHaveProperty("elo");
      expect(bot).toHaveProperty("description");
      expect(bot).toHaveProperty("avatar");
      expect(bot).toHaveProperty("tier");
      expect(bot).toHaveProperty("category");
    });

    it("requires no auth", async () => {
      getPrisma().botProfile.findMany.mockResolvedValue(MOCK_BOTS);

      const res = await app.inject({ method: "GET", url: "/bots" });
      expect(res.statusCode).toBe(200);
    });

    it("returns empty array when no bots in DB", async () => {
      getPrisma().botProfile.findMany.mockResolvedValue([]);

      const res = await app.inject({ method: "GET", url: "/bots" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.bots).toEqual([]);
    });
  });
});
