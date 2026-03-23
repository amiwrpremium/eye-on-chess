import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { getPrisma, authHeader, type FastifyInstance, createApp } from "../test/setup.js";

import { noteRoutes } from "./notes.js";

describe("noteRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(noteRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /games/:id/notes ────────────────────────

  describe("GET /games/:id/notes", () => {
    it("returns existing note", async () => {
      const prisma = getPrisma();
      const updatedAt = new Date();
      prisma.gameNote.findUnique.mockResolvedValue({
        text: "Great game!",
        updatedAt,
      });

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/notes",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.note.text).toBe("Great game!");
    });

    it("returns null when no note exists", async () => {
      const prisma = getPrisma();
      prisma.gameNote.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/notes",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).note).toBeNull();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/notes",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── PUT /games/:id/notes ────────────────────────

  describe("PUT /games/:id/notes", () => {
    it("creates or updates a note", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({ id: "g-1" });
      const updatedAt = new Date();
      prisma.gameNote.upsert.mockResolvedValue({
        text: "Updated note",
        updatedAt,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/games/g-1/notes",
        headers: authHeader(),
        payload: { text: "Updated note" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.note.text).toBe("Updated note");
    });

    it("deletes note when text is empty", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({ id: "g-1" });
      prisma.gameNote.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "PUT",
        url: "/games/g-1/notes",
        headers: authHeader(),
        payload: { text: "" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).note).toBeNull();
    });

    it("deletes note when text is missing", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({ id: "g-1" });
      prisma.gameNote.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "PUT",
        url: "/games/g-1/notes",
        headers: authHeader(),
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).note).toBeNull();
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "PUT",
        url: "/games/nonexistent/notes",
        headers: authHeader(),
        payload: { text: "A note" },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
