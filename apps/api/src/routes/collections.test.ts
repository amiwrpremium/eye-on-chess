import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

import { collectionRoutes } from "./collections.js";

describe("collectionRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(collectionRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /collections ────────────────────────────

  describe("GET /collections", () => {
    it("returns list of user collections", async () => {
      const prisma = getPrisma();
      prisma.collection.findMany.mockResolvedValue([
        { id: "c-1", name: "Favorites", createdAt: new Date(), _count: { games: 3 } },
        { id: "c-2", name: "Openings", createdAt: new Date(), _count: { games: 0 } },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/collections",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collections).toHaveLength(2);
      expect(body.collections[0].name).toBe("Favorites");
      expect(body.collections[0].gameCount).toBe(3);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/collections",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /collections ───────────────────────────

  describe("POST /collections", () => {
    it("creates a collection successfully", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue(null);
      prisma.collection.create.mockResolvedValue({
        id: "c-new",
        name: "My Collection",
        userId: TEST_USER.id,
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: "POST",
        url: "/collections",
        headers: authHeader(),
        payload: { name: "My Collection" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collection.name).toBe("My Collection");
    });

    it("returns 400 when name is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/collections",
        headers: authHeader(),
        payload: { name: "" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 409 for duplicate name", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({ id: "c-existing" });

      const res = await app.inject({
        method: "POST",
        url: "/collections",
        headers: authHeader(),
        payload: { name: "Favorites" },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // ── DELETE /collections/:id ─────────────────────

  describe("DELETE /collections/:id", () => {
    it("deletes a collection successfully", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Custom",
      });
      prisma.collection.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/collections/c-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when not found", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/collections/nonexistent",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not owner", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: "other-user",
        name: "Custom",
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/collections/c-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when trying to delete Favorites", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Favorites",
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/collections/c-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/favorites/i);
    });
  });

  // ── GET /collections/:id/games ──────────────────

  describe("GET /collections/:id/games", () => {
    it.skip("returns paginated games in collection", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Favorites",
      });
      prisma.gameCollection.findMany.mockResolvedValue([
        {
          game: {
            id: "g-1",
            status: "COMPLETED",
            result: "WHITE_WIN",
            termination: "CHECKMATE",
            timeControl: "RAPID",
            isVsBot: false,
            botElo: null,
            createdAt: new Date(),
            whiteId: TEST_USER.id,
            blackId: "other-id",
            white: { username: "testuser", rating: 1200 },
            black: { username: "opponent", rating: 1300 },
          },
        },
      ]);
      prisma.gameCollection.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/collections/c-1/games",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.games).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
      expect(body.collection.name).toBe("Favorites");
    });

    it("returns 404 for non-existent collection", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/collections/nonexistent/games",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not owner", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: "other-user",
        name: "Other",
      });

      const res = await app.inject({
        method: "GET",
        url: "/collections/c-1/games",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /collections/:id/games ─────────────────

  describe("POST /collections/:id/games", () => {
    it("adds a game to a collection", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Favorites",
      });
      prisma.gameCollection.findUnique.mockResolvedValue(null);
      prisma.gameCollection.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/collections/c-1/games",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns success if already in collection", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Favorites",
      });
      prisma.gameCollection.findUnique.mockResolvedValue({ id: "gc-1" });

      const res = await app.inject({
        method: "POST",
        url: "/collections/c-1/games",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toMatch(/already/i);
    });
  });

  // ── DELETE /collections/:id/games/:gameId ───────

  describe("DELETE /collections/:id/games/:gameId", () => {
    it("removes a game from collection", async () => {
      const prisma = getPrisma();
      prisma.collection.findUnique.mockResolvedValue({
        id: "c-1",
        userId: TEST_USER.id,
        name: "Favorites",
      });
      prisma.gameCollection.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/collections/c-1/games/g-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  // ── GET /games/:id/collections ──────────────────

  describe("GET /games/:id/collections", () => {
    it("returns collections a game belongs to", async () => {
      const prisma = getPrisma();
      prisma.gameCollection.findMany.mockResolvedValue([
        { collection: { id: "c-1", name: "Favorites" } },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/collections",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.collections).toHaveLength(1);
      expect(body.collections[0].name).toBe("Favorites");
    });
  });
});
