import { describe, it, expect } from "vitest";
import {
  computeRecord,
  computeRatingHistory,
  computeOpeningStats,
  computeStreaks,
  computeActivity,
} from "./statsCompute.js";

// ---------- helpers ----------

const USER_ID = "user-1";
const OPPONENT_ID = "user-2";

type GameRow = Parameters<typeof computeRecord>[0][number];

function makeGame(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    result: overrides.result ?? "WHITE_WIN",
    whiteId: overrides.whiteId ?? USER_ID,
    blackId: overrides.blackId ?? OPPONENT_ID,
    isVsBot: overrides.isVsBot ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-03-15T12:00:00Z"),
    white: overrides.white ?? { rating: 1200 },
    black: overrides.black ?? { rating: 1200 },
    moves: overrides.moves ?? [{ san: "e4" }, { san: "e5" }],
  };
}

// ---------- computeRecord ----------

describe("computeRecord", () => {
  it("returns all zeros for empty games", () => {
    const result = computeRecord([], USER_ID);
    expect(result).toEqual({
      wins: 0,
      losses: 0,
      draws: 0,
      vsHuman: { wins: 0, losses: 0, draws: 0 },
      vsBot: { wins: 0, losses: 0, draws: 0 },
    });
  });

  it("counts wins/losses/draws correctly for mixed results", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID }),
      makeGame({ result: "DRAW", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
    ];
    const result = computeRecord(games, USER_ID);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.draws).toBe(1);
  });

  it("separates vsBot and vsHuman breakdowns", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID, isVsBot: false }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID, isVsBot: true }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID, isVsBot: true }),
    ];
    const result = computeRecord(games, USER_ID);
    expect(result.vsHuman).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(result.vsBot).toEqual({ wins: 1, losses: 1, draws: 0 });
  });

  it("correctly counts player as white winning", () => {
    const games = [makeGame({ result: "WHITE_WIN", whiteId: USER_ID, blackId: OPPONENT_ID })];
    const result = computeRecord(games, USER_ID);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
  });

  it("correctly counts player as black winning", () => {
    const games = [makeGame({ result: "BLACK_WIN", whiteId: OPPONENT_ID, blackId: USER_ID })];
    const result = computeRecord(games, USER_ID);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
  });

  it("correctly counts player as white losing", () => {
    const games = [makeGame({ result: "BLACK_WIN", whiteId: USER_ID, blackId: OPPONENT_ID })];
    const result = computeRecord(games, USER_ID);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(1);
  });
});

// ---------- computeRatingHistory ----------

describe("computeRatingHistory", () => {
  it("returns just the starting 1200 point for empty games", () => {
    const result = computeRatingHistory([], USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(1200);
  });

  it("rating goes up after a win", () => {
    const games = [makeGame({ result: "WHITE_WIN", whiteId: USER_ID })];
    const result = computeRatingHistory(games, USER_ID);
    expect(result).toHaveLength(2);
    expect(result[1].rating).toBeGreaterThan(1200);
  });

  it("rating goes down after a loss", () => {
    const games = [makeGame({ result: "BLACK_WIN", whiteId: USER_ID })];
    const result = computeRatingHistory(games, USER_ID);
    expect(result).toHaveLength(2);
    expect(result[1].rating).toBeLessThan(1200);
  });

  it("bot games are skipped (rating unchanged)", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID, isVsBot: true }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID, isVsBot: true }),
    ];
    const result = computeRatingHistory(games, USER_ID);
    // Only the starting point, no additional entries for bot games
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(1200);
  });

  it("history starts at 1200", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID }),
    ];
    const result = computeRatingHistory(games, USER_ID);
    expect(result[0].rating).toBe(1200);
  });

  it("includes date strings from game createdAt", () => {
    const games = [
      makeGame({
        result: "WHITE_WIN",
        whiteId: USER_ID,
        createdAt: new Date("2026-03-10T10:00:00Z"),
      }),
    ];
    const result = computeRatingHistory(games, USER_ID);
    expect(result[1].date).toBe("2026-03-10");
  });
});

// ---------- computeOpeningStats ----------

describe("computeOpeningStats", () => {
  it("tallies games with recognized openings", () => {
    // Use "e4 e5" prefix which doesn't match any ECO entry on its own,
    // but "e4 c5 Nf3 d6 d4 cxd4 Nxd4" matches Sicilian Defense: Open (B32)
    const games = [
      makeGame({
        result: "WHITE_WIN",
        whiteId: USER_ID,
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"].map((san) => ({ san })),
      }),
      makeGame({
        result: "BLACK_WIN",
        whiteId: USER_ID,
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"].map((san) => ({ san })),
      }),
    ];
    const result = computeOpeningStats(games, USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].eco).toBe("B32");
    expect(result[0].wins).toBe(1);
    expect(result[0].losses).toBe(1);
    expect(result[0].count).toBe(2);
  });

  it("respects top 5 limit", () => {
    const openingMoves = [
      ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"], // B32 Sicilian Open
      ["e4", "e6", "d4", "d5", "exd5", "exd5"], // C01 French Exchange
      ["d4", "Nf6", "c4", "g6", "Nc3", "d5"], // D80 Grunfeld
      ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4"], // B18 Caro-Kann
      ["d4", "Nf6", "c4", "c5", "d5", "e6"], // A60 Modern Benoni
      ["e4", "d6", "d4", "Nf6", "Nc3", "g6"], // B08 Pirc
    ];

    const games = openingMoves.map((moves) =>
      makeGame({
        result: "WHITE_WIN",
        whiteId: USER_ID,
        moves: moves.map((san) => ({ san })),
      })
    );

    const result = computeOpeningStats(games, USER_ID);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("counts win/loss/draw per opening correctly", () => {
    const sicilianMoves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"].map((s) => ({ san: s }));
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID, moves: sicilianMoves }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID, moves: sicilianMoves }),
      makeGame({ result: "DRAW", whiteId: USER_ID, moves: sicilianMoves }),
    ];
    const result = computeOpeningStats(games, USER_ID);
    expect(result[0].wins).toBe(1);
    expect(result[0].losses).toBe(1);
    expect(result[0].draws).toBe(1);
    expect(result[0].count).toBe(3);
  });

  it("skips games without recognized openings", () => {
    const games = [
      makeGame({
        result: "WHITE_WIN",
        whiteId: USER_ID,
        moves: [{ san: "a3" }], // No known opening
      }),
    ];
    const result = computeOpeningStats(games, USER_ID);
    expect(result).toHaveLength(0);
  });
});

// ---------- computeStreaks ----------

describe("computeStreaks", () => {
  it("returns current=none and bestWin=0 for empty games", () => {
    const result = computeStreaks([], USER_ID);
    expect(result.current.type).toBe("none");
    expect(result.current.count).toBe(0);
    expect(result.bestWin).toBe(0);
  });

  it("all wins: current streak=win with total count, bestWin=total count", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
    ];
    const result = computeStreaks(games, USER_ID);
    expect(result.current.type).toBe("win");
    expect(result.current.count).toBe(3);
    expect(result.bestWin).toBe(3);
  });

  it("win then loss: current=loss 1, bestWin=win count before loss", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID }), // loss
    ];
    const result = computeStreaks(games, USER_ID);
    expect(result.current.type).toBe("loss");
    expect(result.current.count).toBe(1);
    expect(result.bestWin).toBe(2);
  });

  it("draw breaks streak and sets current to none", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "DRAW", whiteId: USER_ID }),
    ];
    const result = computeStreaks(games, USER_ID);
    // Last game is a draw, which is neither win nor loss
    expect(result.current.type).toBe("none");
    expect(result.current.count).toBe(1);
    expect(result.bestWin).toBe(1);
  });

  it("tracks best win streak across multiple streaks", () => {
    const games = [
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "BLACK_WIN", whiteId: USER_ID }), // loss
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
      makeGame({ result: "WHITE_WIN", whiteId: USER_ID }),
    ];
    const result = computeStreaks(games, USER_ID);
    expect(result.bestWin).toBe(3);
    expect(result.current.type).toBe("win");
    expect(result.current.count).toBe(2);
  });
});

// ---------- computeActivity ----------

describe("computeActivity", () => {
  it("excludes games older than 30 days", () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const games = [makeGame({ createdAt: oldDate })];
    const result = computeActivity(games);
    expect(result).toHaveLength(0);
  });

  it("counts recent games by day", () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const games = [
      makeGame({ createdAt: today }),
      makeGame({ createdAt: today }),
      makeGame({ createdAt: yesterday }),
    ];
    const result = computeActivity(games);
    expect(result).toHaveLength(2);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const todayEntry = result.find((r) => r.date === todayStr);
    const yesterdayEntry = result.find((r) => r.date === yesterdayStr);
    expect(todayEntry?.count).toBe(2);
    expect(yesterdayEntry?.count).toBe(1);
  });

  it("result is sorted chronologically", () => {
    const day1 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const day2 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const games = [makeGame({ createdAt: day2 }), makeGame({ createdAt: day1 })];
    const result = computeActivity(games);
    expect(result).toHaveLength(2);
    expect(result[0].date < result[1].date).toBe(true);
  });

  it("returns empty array when no games provided", () => {
    expect(computeActivity([])).toEqual([]);
  });
});
