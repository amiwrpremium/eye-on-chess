import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./redis.js", () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
    setex: vi.fn(),
    exists: vi.fn(),
    pipeline: vi.fn(),
    llen: vi.fn(),
  },
}));

import { redis } from "./redis.js";
import {
  initClocks,
  getClocks,
  getClocksRealtime,
  onMove,
  isTimeout,
  removeActiveGame,
  getActiveGameIds,
  type ClockState,
} from "./gameClock.js";

const mockRedis = redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe("gameClock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initClocks", () => {
    it("should initialize clock state in Redis", async () => {
      await initClocks("game1", 600_000, 5_000);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "clock:game1",
        expect.stringContaining('"whiteTimeLeft":600000')
      );
      expect(mockRedis.sadd).toHaveBeenCalledWith("active_games", "game1");
    });

    it("should set correct initial values", async () => {
      await initClocks("game1", 300_000, 3_000);
      const saved = JSON.parse(mockRedis.set.mock.calls[0][1]) as ClockState;
      expect(saved.whiteTimeLeft).toBe(300_000);
      expect(saved.blackTimeLeft).toBe(300_000);
      expect(saved.turn).toBe("white");
      expect(saved.increment).toBe(3_000);
      expect(saved.lastMoveTimestamp).toBeGreaterThan(0);
    });
  });

  describe("getClocks", () => {
    it("should return null if no clock state", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const result = await getClocks("nonexistent");
      expect(result).toBeNull();
    });

    it("should return parsed clock state", async () => {
      const state: ClockState = {
        whiteTimeLeft: 500_000,
        blackTimeLeft: 450_000,
        lastMoveTimestamp: Date.now(),
        turn: "white",
        increment: 5_000,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));
      const result = await getClocks("game1");
      expect(result).toEqual(state);
    });
  });

  describe("getClocksRealtime", () => {
    it("should deduct elapsed time for active player", async () => {
      const state: ClockState = {
        whiteTimeLeft: 60_000,
        blackTimeLeft: 60_000,
        lastMoveTimestamp: Date.now() - 5_000, // 5 seconds ago
        turn: "white",
        increment: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));
      const result = await getClocksRealtime("game1");
      expect(result!.whiteTimeLeft).toBeLessThan(60_000);
      expect(result!.whiteTimeLeft).toBeGreaterThan(54_000);
      expect(result!.blackTimeLeft).toBe(60_000); // Black not affected
    });

    it("should not go below zero", async () => {
      const state: ClockState = {
        whiteTimeLeft: 1_000,
        blackTimeLeft: 60_000,
        lastMoveTimestamp: Date.now() - 10_000, // 10 seconds ago
        turn: "white",
        increment: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));
      const result = await getClocksRealtime("game1");
      expect(result!.whiteTimeLeft).toBe(0);
    });
  });

  describe("onMove", () => {
    it("should deduct time and add increment", async () => {
      const state: ClockState = {
        whiteTimeLeft: 60_000,
        blackTimeLeft: 60_000,
        lastMoveTimestamp: Date.now() - 3_000, // 3 seconds ago
        turn: "white",
        increment: 5_000,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));

      const result = await onMove("game1", false);
      expect(result!.whiteTimeLeft).toBeCloseTo(62_000, -3); // 60 - 3 + 5 = 62
      expect(result!.turn).toBe("black");
    });

    it("should not modify clocks for unlimited games", async () => {
      const state: ClockState = {
        whiteTimeLeft: 0,
        blackTimeLeft: 0,
        lastMoveTimestamp: Date.now() - 100_000,
        turn: "white",
        increment: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));

      const result = await onMove("game1", true);
      expect(result!.whiteTimeLeft).toBe(0);
      expect(result!.turn).toBe("black");
    });
  });

  describe("isTimeout", () => {
    it("should detect white timeout", async () => {
      const state: ClockState = {
        whiteTimeLeft: 500,
        blackTimeLeft: 60_000,
        lastMoveTimestamp: Date.now() - 2_000,
        turn: "white",
        increment: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));
      const result = await isTimeout("game1");
      expect(result).toBe("white");
    });

    it("should return null when no timeout", async () => {
      const state: ClockState = {
        whiteTimeLeft: 60_000,
        blackTimeLeft: 60_000,
        lastMoveTimestamp: Date.now(),
        turn: "white",
        increment: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));
      const result = await isTimeout("game1");
      expect(result).toBeNull();
    });
  });

  describe("removeActiveGame", () => {
    it("should remove game from active set and delete clock", async () => {
      await removeActiveGame("game1");
      expect(mockRedis.srem).toHaveBeenCalledWith("active_games", "game1");
      expect(mockRedis.del).toHaveBeenCalledWith("clock:game1");
    });
  });

  describe("getActiveGameIds", () => {
    it("should return active game IDs", async () => {
      mockRedis.smembers.mockResolvedValueOnce(["game1", "game2"]);
      const result = await getActiveGameIds();
      expect(result).toEqual(["game1", "game2"]);
    });
  });
});
