import { describe, it, expect } from "vitest";
import { computeElo } from "./elo.js";

describe("computeElo", () => {
  it("should increase winner rating and decrease loser rating for white win", () => {
    const result = computeElo(1200, 1200, "WHITE_WIN");
    expect(result.newWhiteRating).toBeGreaterThan(1200);
    expect(result.newBlackRating).toBeLessThan(1200);
  });

  it("should increase winner rating and decrease loser rating for black win", () => {
    const result = computeElo(1200, 1200, "BLACK_WIN");
    expect(result.newWhiteRating).toBeLessThan(1200);
    expect(result.newBlackRating).toBeGreaterThan(1200);
  });

  it("should not change ratings significantly for a draw between equal players", () => {
    const result = computeElo(1200, 1200, "DRAW");
    expect(result.newWhiteRating).toBe(1200);
    expect(result.newBlackRating).toBe(1200);
  });

  it("should give ~16 points to winner with K=32 for equal ratings (1500 vs 1500)", () => {
    const result = computeElo(1500, 1500, "WHITE_WIN");
    const whiteGain = result.newWhiteRating - 1500;
    expect(whiteGain).toBe(16);
  });

  it("should give more points for beating a higher-rated player", () => {
    const upset = computeElo(1000, 1400, "WHITE_WIN");
    const expected = computeElo(1200, 1200, "WHITE_WIN");
    const whiteGainUpset = upset.newWhiteRating - 1000;
    const whiteGainExpected = expected.newWhiteRating - 1200;
    expect(whiteGainUpset).toBeGreaterThan(whiteGainExpected);
  });

  it("should give fewer points for beating a lower-rated player", () => {
    const easy = computeElo(1400, 1000, "WHITE_WIN");
    const whiteGain = easy.newWhiteRating - 1400;
    expect(whiteGain).toBeLessThan(16); // K=32, expected ~0.9, gain ~3
  });

  it("should be symmetric: total rating change sums to zero", () => {
    const result = computeElo(1300, 1100, "WHITE_WIN");
    const totalChange = result.newWhiteRating - 1300 + (result.newBlackRating - 1100);
    expect(Math.abs(totalChange)).toBeLessThanOrEqual(1); // rounding
  });

  it("should handle large rating differences", () => {
    const result = computeElo(2000, 800, "WHITE_WIN");
    expect(result.newWhiteRating).toBeGreaterThanOrEqual(2000);
    expect(result.newBlackRating).toBeLessThanOrEqual(800);
  });

  it("big rating gap: underdog winning gains more than favorite losing", () => {
    const result = computeElo(2000, 1200, "BLACK_WIN");
    const blackGain = result.newBlackRating - 1200;
    const whiteLoss = 2000 - result.newWhiteRating;
    // Both should be large (near K=32) for such an upset
    expect(blackGain).toBeGreaterThan(25);
    expect(whiteLoss).toBeGreaterThan(25);
  });

  it("should penalize heavily for losing to much lower rated", () => {
    const result = computeElo(2000, 800, "BLACK_WIN");
    const whiteLoss = 2000 - result.newWhiteRating;
    expect(whiteLoss).toBeGreaterThan(25); // nearly full K
  });

  it("should handle draw between mismatched players", () => {
    const result = computeElo(1500, 1200, "DRAW");
    // Higher-rated player loses points, lower gains
    expect(result.newWhiteRating).toBeLessThan(1500);
    expect(result.newBlackRating).toBeGreaterThan(1200);
  });

  it("draw between equal players: both stay the same", () => {
    const result = computeElo(1500, 1500, "DRAW");
    expect(result.newWhiteRating).toBe(1500);
    expect(result.newBlackRating).toBe(1500);
  });

  it("ratings are rounded to integers", () => {
    const result = computeElo(1500, 1300, "WHITE_WIN");
    expect(Number.isInteger(result.newWhiteRating)).toBe(true);
    expect(Number.isInteger(result.newBlackRating)).toBe(true);
  });

  it("symmetry: swapping colors and result produces same magnitude change", () => {
    const r1 = computeElo(1600, 1400, "WHITE_WIN");
    const r2 = computeElo(1400, 1600, "BLACK_WIN");
    const whiteGain1 = r1.newWhiteRating - 1600;
    const blackGain2 = r2.newBlackRating - 1600;
    expect(whiteGain1).toBe(blackGain2);
  });
});
