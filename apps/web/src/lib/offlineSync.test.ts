import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
vi.mock("./api", () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from "./api";
import {
  saveOfflineGame,
  getPendingCount,
  syncOfflineGames,
  generateOfflineGameId,
} from "./offlineSync";

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
});

function makeGame(id: string) {
  return {
    id,
    botElo: 1200,
    playerIsWhite: true,
    moves: [
      {
        ply: 1,
        san: "e4",
        uci: "e2e4",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      },
    ],
    result: "1-0",
    termination: "checkmate",
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-01T00:30:00Z",
  };
}

describe("offlineSync", () => {
  beforeEach(() => {
    // Clear the store
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    vi.clearAllMocks();
  });

  describe("saveOfflineGame", () => {
    it("adds a game to storage", () => {
      saveOfflineGame(makeGame("offline-1"));
      expect(getPendingCount()).toBe(1);
    });

    it("updates existing game with same id", () => {
      saveOfflineGame(makeGame("offline-1"));
      const updated = { ...makeGame("offline-1"), result: "0-1" };
      saveOfflineGame(updated);
      expect(getPendingCount()).toBe(1);
      const stored = JSON.parse(store["eyeonchess-offline-games"]);
      expect(stored[0].result).toBe("0-1");
    });

    it("appends different games", () => {
      saveOfflineGame(makeGame("offline-1"));
      saveOfflineGame(makeGame("offline-2"));
      expect(getPendingCount()).toBe(2);
    });
  });

  describe("getPendingCount", () => {
    it("returns correct count", () => {
      saveOfflineGame(makeGame("offline-1"));
      saveOfflineGame(makeGame("offline-2"));
      saveOfflineGame(makeGame("offline-3"));
      expect(getPendingCount()).toBe(3);
    });

    it("returns 0 when empty", () => {
      expect(getPendingCount()).toBe(0);
    });
  });

  describe("generateOfflineGameId", () => {
    it("returns string starting with 'offline-'", () => {
      const id = generateOfflineGameId();
      expect(id).toMatch(/^offline-/);
    });

    it("returns unique values", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateOfflineGameId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("syncOfflineGames", () => {
    it("calls /api/games/sync for each game and removes synced games", async () => {
      saveOfflineGame(makeGame("offline-1"));
      saveOfflineGame(makeGame("offline-2"));

      vi.mocked(api.post).mockResolvedValue({ data: {} });

      const synced = await syncOfflineGames();

      expect(synced).toBe(2);
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.post).toHaveBeenCalledWith(
        "/api/games/sync",
        expect.objectContaining({ botElo: 1200 })
      );
      expect(getPendingCount()).toBe(0);
    });

    it("keeps failed games in storage", async () => {
      saveOfflineGame(makeGame("offline-1"));
      saveOfflineGame(makeGame("offline-2"));

      vi.mocked(api.post)
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(new Error("Network error"));

      const synced = await syncOfflineGames();

      expect(synced).toBe(1);
      expect(getPendingCount()).toBe(1);
      const remaining = JSON.parse(store["eyeonchess-offline-games"]);
      expect(remaining[0].id).toBe("offline-2");
    });

    it("returns 0 when no pending games", async () => {
      const synced = await syncOfflineGames();
      expect(synced).toBe(0);
      expect(api.post).not.toHaveBeenCalled();
    });
  });
});
