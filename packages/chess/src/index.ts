export type Color = "white" | "black";

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export interface Piece {
  color: Color;
  type: PieceType;
}
