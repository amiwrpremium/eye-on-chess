import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { detectGameEnd } from "./gameHelpers.js";

describe("detectGameEnd", () => {
  it("returns null for starting position (no game over)", () => {
    const chess = new Chess();
    expect(detectGameEnd(chess)).toBeNull();
  });

  it("returns null for a non-game-over position after a few moves", () => {
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    chess.move("Nf3");
    expect(detectGameEnd(chess)).toBeNull();
  });

  it("returns WHITE_WIN and CHECKMATE for Scholar's mate", () => {
    const chess = new Chess();
    // Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#
    chess.move("e4");
    chess.move("e5");
    chess.move("Bc4");
    chess.move("Nc6");
    chess.move("Qh5");
    chess.move("Nf6");
    chess.move("Qxf7");

    const result = detectGameEnd(chess);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("WHITE_WIN");
    expect(result!.termination).toBe("CHECKMATE");
  });

  it("returns BLACK_WIN and CHECKMATE for Fool's mate", () => {
    const chess = new Chess();
    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    chess.move("f3");
    chess.move("e5");
    chess.move("g4");
    chess.move("Qh4");

    const result = detectGameEnd(chess);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("BLACK_WIN");
    expect(result!.termination).toBe("CHECKMATE");
  });

  it("returns DRAW and AGREEMENT for stalemate", () => {
    // A known stalemate position: white king on a1, white queen on b6, black king on a8
    // We load a FEN that produces stalemate after one move
    const chess = new Chess("k7/8/1K6/8/8/8/8/7Q w - - 0 1");
    // Qa8 would be checkmate, but Qb8 would also be check. Let's use a known stalemate:
    // White to move, can stalemate black with Qb6 -> then black has no legal moves
    // Actually, let's use a simpler setup
    const stalemateChess = new Chess("k7/8/1Q1K4/8/8/8/8/8 b - - 0 1");
    // Black king on a8, white queen on b6, white king on d6. Black to move - no legal moves, not in check = stalemate.
    expect(stalemateChess.isStalemate()).toBe(true);

    const result = detectGameEnd(stalemateChess);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("DRAW");
    expect(result!.termination).toBe("AGREEMENT");
  });

  it("returns null when game is still in progress", () => {
    const chess = new Chess();
    chess.move("d4");
    chess.move("d5");
    chess.move("c4");
    expect(chess.isGameOver()).toBe(false);
    expect(detectGameEnd(chess)).toBeNull();
  });
});
