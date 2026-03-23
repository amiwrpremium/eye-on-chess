import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

// Mock gameHelpers
vi.mock("../lib/gameHelpers.js", () => ({
  detectGameEnd: vi.fn().mockReturnValue(null),
}));

// Mock chess.js
vi.mock("chess.js", () => {
  const mockChess = {
    fen: vi.fn().mockReturnValue("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
    pgn: vi.fn().mockReturnValue("1. e4"),
    turn: vi.fn().mockReturnValue("w"),
    move: vi.fn().mockReturnValue({
      san: "e4",
      from: "e2",
      to: "e4",
      after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    }),
    isGameOver: vi.fn().mockReturnValue(false),
  };
  return {
    Chess: vi.fn().mockImplementation(() => mockChess),
  };
});

import { gameRoutes } from "./games.js";

describe("gameRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(gameRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /games/friend ──────────────────────────

  describe("POST /games/friend", () => {
    it("creates a friend game with preset", async () => {
      const prisma = getPrisma();
      prisma.friendship.findFirst.mockResolvedValue({ id: "f-1", status: "ACCEPTED" });
      prisma.game.create.mockResolvedValue({
        id: "g-1",
        whiteId: TEST_USER.id,
        blackId: "friend-id",
        status: "WAITING",
        timeControl: "RAPID",
        white: { id: TEST_USER.id, username: "testuser", rating: 1200, avatarUrl: null },
        black: { id: "friend-id", username: "friend", rating: 1300, avatarUrl: null },
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/friend",
        headers: authHeader(),
        payload: { friendId: "friend-id", initialTime: 600, increment: 0 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.game.id).toBe("g-1");
    });

    it("returns 400 when friendId missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/friend",
        headers: authHeader(),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when challenging self", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/friend",
        headers: authHeader(),
        payload: { friendId: TEST_USER.id, initialTime: 600 },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/yourself/i);
    });

    it("returns 403 when not friends", async () => {
      const prisma = getPrisma();
      prisma.friendship.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/friend",
        headers: authHeader(),
        payload: { friendId: "stranger-id", initialTime: 600 },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toMatch(/friends/i);
    });

    it("returns 400 when no time control specified", async () => {
      const prisma = getPrisma();
      prisma.friendship.findFirst.mockResolvedValue({ id: "f-1", status: "ACCEPTED" });

      const res = await app.inject({
        method: "POST",
        url: "/games/friend",
        headers: authHeader(),
        payload: { friendId: "friend-id" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/preset or custom/i);
    });
  });

  // ── POST /games/challenge/accept ────────────────

  describe("POST /games/challenge/accept", () => {
    it("accepts a challenge", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "WAITING",
        whiteId: TEST_USER.id,
        blackId: "other-id",
        timeControl: "RAPID",
        initialTime: 600,
        increment: 0,
      });
      prisma.game.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/accept",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/accept",
        headers: authHeader(),
        payload: { gameId: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when challenge already resolved", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        whiteId: TEST_USER.id,
        blackId: "other",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/accept",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when not part of challenge", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "WAITING",
        whiteId: "someone",
        blackId: "someone-else",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/accept",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /games/challenge/decline ───────────────

  describe("POST /games/challenge/decline", () => {
    it("declines a challenge", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "WAITING",
        whiteId: TEST_USER.id,
        blackId: "other",
      });
      prisma.game.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/decline",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/decline",
        headers: authHeader(),
        payload: { gameId: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when already resolved", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "COMPLETED",
        whiteId: TEST_USER.id,
        blackId: "other",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/challenge/decline",
        headers: authHeader(),
        payload: { gameId: "g-1" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /games/:id ──────────────────────────────

  describe("GET /games/:id", () => {
    it("returns game state", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        whiteId: TEST_USER.id,
        blackId: "other",
        white: { id: TEST_USER.id, username: "testuser", rating: 1200, avatarUrl: null },
        black: { id: "other", username: "opponent", rating: 1300, avatarUrl: null },
        moves: [],
      });

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).game.id).toBe("g-1");
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/nonexistent",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /games/:id/pgn ──────────────────────────

  describe("GET /games/:id/pgn", () => {
    it("returns PGN export", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "COMPLETED",
        result: "WHITE_WIN",
        termination: "CHECKMATE",
        timeControl: "RAPID",
        initialTime: 600,
        increment: 0,
        isVsBot: false,
        botElo: null,
        pgn: "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#",
        createdAt: new Date("2025-03-01"),
        whiteId: TEST_USER.id,
        blackId: "other",
        white: { username: "testuser", rating: 1200 },
        black: { username: "opponent", rating: 1300 },
        moves: [],
      });

      const res = await app.inject({
        method: "GET",
        url: "/games/g-1/pgn",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.body).toContain('[White "testuser"]');
      expect(res.body).toContain('[Black "opponent"]');
      expect(res.body).toContain("1-0");
    });

    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/nonexistent/pgn",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /games/active ───────────────────────────

  describe("GET /games/active", () => {
    it("returns active game", async () => {
      const prisma = getPrisma();
      prisma.game.findFirst.mockResolvedValue({
        id: "g-active",
        status: "ACTIVE",
        whiteId: TEST_USER.id,
        blackId: "other",
        white: { id: TEST_USER.id, username: "testuser", rating: 1200, avatarUrl: null },
        black: { id: "other", username: "opponent", rating: 1300, avatarUrl: null },
        moves: [],
      });

      const res = await app.inject({
        method: "GET",
        url: "/games/active",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).game.id).toBe("g-active");
    });

    it("returns null when no active game", async () => {
      const prisma = getPrisma();
      prisma.game.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/games/active",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).game).toBeNull();
    });
  });

  // ── GET /games/history ──────────────────────────

  describe("GET /games/history", () => {
    it("returns paginated game history", async () => {
      const prisma = getPrisma();
      prisma.game.findMany.mockResolvedValue([
        {
          id: "g-1",
          status: "COMPLETED",
          result: "WHITE_WIN",
          termination: "CHECKMATE",
          timeControl: "RAPID",
          isVsBot: false,
          botElo: null,
          createdAt: new Date(),
          endedAt: new Date(),
          whiteId: TEST_USER.id,
          blackId: "other",
          white: { username: "testuser", rating: 1200 },
          black: { username: "opponent", rating: 1300 },
        },
      ]);
      prisma.game.count.mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/games/history",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.games).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/games/history",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /games/bot ─────────────────────────────

  describe("POST /games/bot", () => {
    it("creates a bot game", async () => {
      const prisma = getPrisma();
      prisma.game.create.mockResolvedValue({
        id: "g-bot",
        whiteId: TEST_USER.id,
        blackId: null,
        status: "ACTIVE",
        isVsBot: true,
        botElo: 800,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        white: { id: TEST_USER.id, username: "testuser", rating: 1200, avatarUrl: null },
        black: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/bot",
        headers: authHeader(),
        payload: { botElo: 800, color: "white", initialTime: 600 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.game.id).toBe("g-bot");
      expect(body.game.isVsBot).toBe(true);
    });

    it("returns 400 for invalid botElo", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/bot",
        headers: authHeader(),
        payload: { botElo: 100, color: "white" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBeDefined();
    });

    it("returns 400 for botElo too high", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/bot",
        headers: authHeader(),
        payload: { botElo: 5000, color: "white" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /games/:id/move ────────────────────────

  describe("POST /games/:id/move", () => {
    it("returns 404 when game not found", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/nonexistent/move",
        headers: authHeader(),
        payload: { from: "e2", to: "e4" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when game not active", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "COMPLETED",
        isVsBot: true,
        whiteId: TEST_USER.id,
        blackId: null,
        moves: [],
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/move",
        headers: authHeader(),
        payload: { from: "e2", to: "e4" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/not active/i);
    });

    it("returns 400 when not a bot game", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        isVsBot: false,
        whiteId: TEST_USER.id,
        blackId: "other",
        moves: [],
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/move",
        headers: authHeader(),
        payload: { from: "e2", to: "e4" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/not a bot/i);
    });

    it("returns 403 when not your game", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        isVsBot: true,
        whiteId: "someone-else",
        blackId: null,
        moves: [],
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/move",
        headers: authHeader(),
        payload: { from: "e2", to: "e4" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /games/:id/resign ──────────────────────

  describe("POST /games/:id/resign", () => {
    it("resigns a game as white", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        whiteId: TEST_USER.id,
        blackId: "other",
      });
      prisma.game.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/resign",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.result).toBe("BLACK_WIN");
      expect(body.termination).toBe("RESIGNATION");
    });

    it("returns 400 when game not active", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/resign",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when not your game", async () => {
      const prisma = getPrisma();
      prisma.game.findUnique.mockResolvedValue({
        id: "g-1",
        status: "ACTIVE",
        whiteId: "someone",
        blackId: "someone-else",
      });

      const res = await app.inject({
        method: "POST",
        url: "/games/g-1/resign",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /games/sync ────────────────────────────

  describe("POST /games/sync", () => {
    it("returns 400 when no moves provided", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/games/sync",
        headers: authHeader(),
        payload: {
          botElo: 800,
          playerIsWhite: true,
          moves: [],
          result: null,
          termination: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBeDefined();
    });
  });
});
