/**
 * Classification of a move's quality, determined by engine analysis.
 */
export type MoveClassification =
  | "BRILLIANT"
  | "GREAT"
  | "BEST"
  | "EXCELLENT"
  | "GOOD"
  | "INACCURACY"
  | "MISTAKE"
  | "BLUNDER"
  | "FORCED";

/**
 * A move with its position in the game.
 */
export interface MoveRecord {
  /** Move number within the game (1-indexed) */
  ply: number;
  /** Standard Algebraic Notation (e.g. "Nf3", "O-O") */
  san: string;
  /** FEN position after the move */
  fen: string;
}
