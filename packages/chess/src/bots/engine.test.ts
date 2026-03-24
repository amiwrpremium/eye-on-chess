import { describe, it, expect } from "vitest";
import { computeCustomMove, getStockfishConfig, computeThinkTime, getOpeningMove } from "./engine";
import type { ThinkTimeContext } from "./engine";
import type { BotPersonality } from "./types";

const AMIR: BotPersonality = {
  id: "amir",
  name: "Amir",
  elo: 200,
  description: "Test",
  avatar: "T",
  tier: "custom",
  category: "beginner",
  randomMoveChance: 0.45,
  blunderChance: 0.3,
  captureGreed: 0.2,
  aggressionBias: 0,
  maxDepth: 1,
  queenEarly: false,
  pawnPusher: true,
};

const HANA: BotPersonality = {
  id: "hana",
  name: "Hana",
  elo: 2000,
  description: "Test",
  avatar: "T",
  tier: "engine",
  category: "expert",
  randomMoveChance: 0,
  blunderChance: 0,
  captureGreed: 0.35,
  aggressionBias: 0,
  maxDepth: 12,
  queenEarly: false,
  pawnPusher: false,
};

const VIKTOR: BotPersonality = {
  id: "viktor",
  name: "Viktor",
  elo: 1300,
  description: "Test",
  avatar: "T",
  tier: "hybrid",
  category: "advanced",
  randomMoveChance: 0.05,
  blunderChance: 0.12,
  captureGreed: 0.5,
  aggressionBias: 0.9,
  maxDepth: 4,
  queenEarly: false,
  pawnPusher: false,
};

describe("computeCustomMove", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const checkmatedFen = "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

  it("returns a valid UCI move string from the starting position", () => {
    const move = computeCustomMove(startFen, AMIR);
    expect(move).not.toBeNull();
    expect(move!.length).toBeGreaterThanOrEqual(4);
    expect(move!.length).toBeLessThanOrEqual(5);
  });

  it("returns null for a checkmate position", () => {
    const move = computeCustomMove(checkmatedFen, AMIR);
    expect(move).toBeNull();
  });

  it("returns different moves over multiple runs with high randomness", () => {
    const moves = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const move = computeCustomMove(startFen, AMIR);
      if (move) moves.add(move);
    }
    expect(moves.size).toBeGreaterThan(1);
  });
});

describe("getStockfishConfig", () => {
  it("returns correct config for engine tier", () => {
    const config = getStockfishConfig(HANA);
    expect(config.uciElo).toBe(2000);
    expect(config.blunderChance).toBe(0);
    expect(config.depth).toBe(12);
  });

  it("returns correct config for hybrid tier", () => {
    const config = getStockfishConfig(VIKTOR);
    expect(config.uciElo).toBe(0);
    expect(config.blunderChance).toBeGreaterThan(0);
    expect(config.depth).toBe(4);
  });
});

const ERFAN: BotPersonality = {
  id: "erfan",
  name: "Erfan",
  elo: 3200,
  description: "Test",
  avatar: "T",
  tier: "engine",
  category: "grandmaster",
  randomMoveChance: 0,
  blunderChance: 0,
  captureGreed: 0.35,
  aggressionBias: 0,
  maxDepth: 18,
  queenEarly: false,
  pawnPusher: false,
};

const defaultCtx: ThinkTimeContext = {
  ply: 20,
  isInCheck: false,
  isCapture: false,
  evalCp: 0,
  playerBlundered: false,
};

function avgThinkTime(bot: BotPersonality, ctx: ThinkTimeContext, n = 200): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += computeThinkTime(bot, ctx);
  return total / n;
}

describe("computeThinkTime", () => {
  it("always returns between 200 and 4000ms", () => {
    for (let i = 0; i < 200; i++) {
      const delay = computeThinkTime(AMIR, defaultCtx);
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(4000);
    }
  });

  it("beginners think longer than masters on average", () => {
    expect(avgThinkTime(AMIR, defaultCtx)).toBeGreaterThan(avgThinkTime(HANA, defaultCtx));
  });

  it("grandmasters are fastest on average", () => {
    expect(avgThinkTime(ERFAN, defaultCtx)).toBeLessThan(avgThinkTime(HANA, defaultCtx));
  });

  it("increases delay when in check", () => {
    const normal = avgThinkTime(AMIR, defaultCtx);
    const checked = avgThinkTime(AMIR, { ...defaultCtx, isInCheck: true });
    expect(checked).toBeGreaterThan(normal);
  });

  it("decreases delay after player blunder", () => {
    const normal = avgThinkTime(AMIR, defaultCtx);
    const blundered = avgThinkTime(AMIR, { ...defaultCtx, playerBlundered: true });
    expect(blundered).toBeLessThan(normal);
  });

  it("plays faster in the opening", () => {
    const midgame = avgThinkTime(AMIR, defaultCtx);
    const opening = avgThinkTime(AMIR, { ...defaultCtx, ply: 4 });
    expect(opening).toBeLessThan(midgame);
  });

  it("plays faster when winning", () => {
    const neutral = avgThinkTime(AMIR, defaultCtx);
    const winning = avgThinkTime(AMIR, { ...defaultCtx, evalCp: 500 });
    expect(winning).toBeLessThan(neutral);
  });

  it("plays slower when losing", () => {
    const neutral = avgThinkTime(AMIR, defaultCtx);
    const losing = avgThinkTime(AMIR, { ...defaultCtx, evalCp: -500 });
    expect(losing).toBeGreaterThan(neutral);
  });

  it("captures are faster", () => {
    const normal = avgThinkTime(AMIR, defaultCtx);
    const capture = avgThinkTime(AMIR, { ...defaultCtx, isCapture: true });
    expect(capture).toBeLessThan(normal);
  });
});

const BELLA_WITH_OPENINGS: BotPersonality = {
  ...AMIR,
  id: "bella",
  name: "Bella",
  elo: 400,
  randomMoveChance: 0,
  blunderChance: 0,
  preferredOpenings: {
    asWhite: ["e4 e5 Qh5", "e4 e5 Bc4"],
    asBlack: ["e5", "c5"],
  },
};

describe("getOpeningMove", () => {
  it("returns first move of preferred opening at game start (white)", () => {
    const move = getOpeningMove(BELLA_WITH_OPENINGS, [], true);
    expect(move).toBe("e4");
  });

  it("returns second move when history matches prefix (white)", () => {
    const move = getOpeningMove(BELLA_WITH_OPENINGS, ["e4", "e5"], true);
    expect(["Qh5", "Bc4"]).toContain(move);
  });

  it("returns first move as black", () => {
    const move = getOpeningMove(BELLA_WITH_OPENINGS, [], false);
    expect(["e5", "c5"]).toContain(move);
  });

  it("returns null when history deviates from all openings", () => {
    const move = getOpeningMove(BELLA_WITH_OPENINGS, ["d4", "d5"], true);
    expect(move).toBeNull();
  });

  it("returns null when no preferred openings defined", () => {
    const move = getOpeningMove(AMIR, [], true);
    expect(move).toBeNull();
  });

  it("returns null when opening sequence exhausted", () => {
    const move = getOpeningMove(BELLA_WITH_OPENINGS, ["e4", "e5", "Qh5", "Nc6"], true);
    expect(move).toBeNull();
  });

  it("returns null for empty asWhite when playing white", () => {
    const bot: BotPersonality = {
      ...AMIR,
      preferredOpenings: { asBlack: ["e5"] },
    };
    const move = getOpeningMove(bot, [], true);
    expect(move).toBeNull();
  });
});
