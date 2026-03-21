import { describe, it, expect } from "vitest";
import type { Color, PieceType, Piece } from "./index.js";

describe("Chess types", () => {
  it("should allow valid Color values", () => {
    const white: Color = "white";
    const black: Color = "black";
    expect(white).toBe("white");
    expect(black).toBe("black");
  });

  it("should allow all PieceType values", () => {
    const types: PieceType[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    expect(types).toHaveLength(6);
  });

  it("should create a valid Piece", () => {
    const piece: Piece = { color: "white", type: "queen" };
    expect(piece.color).toBe("white");
    expect(piece.type).toBe("queen");
  });

  it("should create pieces for all combinations", () => {
    const colors: Color[] = ["white", "black"];
    const types: PieceType[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    const pieces: Piece[] = [];
    for (const color of colors) {
      for (const type of types) {
        pieces.push({ color, type });
      }
    }
    expect(pieces).toHaveLength(12);
  });
});
