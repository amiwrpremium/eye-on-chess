import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp, type FastifyInstance } from "../test/setup.js";
import { botRoutes } from "./bots.js";

describe("botRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(botRoutes);
    });
  });

  afterAll(() => app.close());

  describe("GET /api/bots", () => {
    it("returns 200 with array of bots", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/bots",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.bots)).toBe(true);
      expect(body.bots.length).toBe(31);
    });

    it("has correct structure (id, name, elo, description, avatar)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/bots",
      });

      const body = JSON.parse(res.body);
      const bot = body.bots[0];
      expect(bot).toHaveProperty("id");
      expect(bot).toHaveProperty("name");
      expect(bot).toHaveProperty("elo");
      expect(bot).toHaveProperty("description");
      expect(bot).toHaveProperty("avatar");
    });

    it("requires no auth", async () => {
      // No authorization header — should still succeed
      const res = await app.inject({
        method: "GET",
        url: "/api/bots",
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
