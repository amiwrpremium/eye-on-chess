import { describe, it, expect } from "vitest";
import { computeCustomMove, getStockfishConfig } from "./engine";
import { getBotById, BOT_PERSONALITIES } from "./personalities";

describe("computeCustomMove", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const checkmatedFen = "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

  it("returns a valid UCI move string (4-5 chars) from the starting position", () => {
    const bot = getBotById("amir")!;
    const move = computeCustomMove(startFen, bot);
    expect(move).not.toBeNull();
    expect(move!.length).toBeGreaterThanOrEqual(4);
    expect(move!.length).toBeLessThanOrEqual(5);
  });

  it("returns null for a checkmate position", () => {
    const bot = getBotById("amir")!;
    const move = computeCustomMove(checkmatedFen, bot);
    expect(move).toBeNull();
  });

  it("returns different moves for different personalities over multiple runs", () => {
    // Use a bot with high randomMoveChance for variability
    const bot = getBotById("amir")!;
    const moves = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const move = computeCustomMove(startFen, bot);
      if (move) moves.add(move);
    }
    // With 0.45 randomMoveChance, we should see multiple distinct moves
    expect(moves.size).toBeGreaterThan(1);
  });
});

describe("getStockfishConfig", () => {
  it("returns correct config for engine tier (uciElo matches elo)", () => {
    const bot = getBotById("hana")!;
    expect(bot.tier).toBe("engine");

    const config = getStockfishConfig(bot);
    expect(config.uciElo).toBe(bot.elo);
    expect(config.blunderChance).toBe(0);
    expect(config.depth).toBe(bot.maxDepth);
  });

  it("returns correct config for hybrid tier (uciElo is 0, blunderChance > 0)", () => {
    const bot = getBotById("viktor")!;
    expect(bot.tier).toBe("hybrid");

    const config = getStockfishConfig(bot);
    expect(config.uciElo).toBe(0);
    expect(config.blunderChance).toBeGreaterThan(0);
    expect(config.depth).toBe(bot.maxDepth);
  });

  it("returns appropriate depth per tier", () => {
    // Engine tier bots should have higher depth
    const engineBots = BOT_PERSONALITIES.filter((b) => b.tier === "engine");
    for (const bot of engineBots) {
      const config = getStockfishConfig(bot);
      expect(config.depth).toBeGreaterThanOrEqual(12);
    }

    // Hybrid tier bots should have moderate depth
    const hybridBots = BOT_PERSONALITIES.filter((b) => b.tier === "hybrid");
    for (const bot of hybridBots) {
      const config = getStockfishConfig(bot);
      expect(config.depth).toBeGreaterThanOrEqual(4);
      expect(config.depth).toBeLessThanOrEqual(9);
    }
  });
});
