/**
 * Possible outcomes of a completed chess game.
 */
export type GameResult = "WHITE_WIN" | "BLACK_WIN" | "DRAW" | "ABORTED";

/**
 * Lifecycle status of a chess game.
 *
 * - `WAITING` — challenge sent, waiting for opponent to accept
 * - `ACTIVE` — game in progress
 * - `COMPLETED` — game finished with a result
 * - `ABORTED` — game was cancelled before completion
 */
export type GameStatus = "WAITING" | "ACTIVE" | "COMPLETED" | "ABORTED";

/**
 * How a game ended.
 */
export type Termination = "CHECKMATE" | "RESIGNATION" | "TIMEOUT" | "AGREEMENT";

/**
 * PGN result string mapped from {@link GameResult}.
 */
export const RESULT_PGN: Record<string, string> = {
  WHITE_WIN: "1-0",
  BLACK_WIN: "0-1",
  DRAW: "1/2-1/2",
};

/**
 * Human-readable labels for game results.
 */
export const RESULT_LABELS: Record<string, string> = {
  WHITE_WIN: "White wins",
  BLACK_WIN: "Black wins",
  DRAW: "Draw",
  ABORTED: "Game aborted",
};

/**
 * Human-readable labels for termination reasons.
 */
export const TERMINATION_LABELS: Record<string, string> = {
  CHECKMATE: "by checkmate",
  RESIGNATION: "by resignation",
  TIMEOUT: "on time",
  AGREEMENT: "by agreement",
};
