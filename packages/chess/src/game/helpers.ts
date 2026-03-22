import type { GameResult } from "./types.js";

/**
 * Determine if the player won based on their color and the game result.
 *
 * @param isWhite - whether the player is playing white
 * @param result - the game result
 * @returns `true` if the player won
 */
export function didPlayerWin(isWhite: boolean, result: GameResult): boolean {
  return (isWhite && result === "WHITE_WIN") || (!isWhite && result === "BLACK_WIN");
}

/**
 * Determine if the player lost based on their color and the game result.
 *
 * @param isWhite - whether the player is playing white
 * @param result - the game result
 * @returns `true` if the player lost
 */
export function didPlayerLose(isWhite: boolean, result: GameResult): boolean {
  return (isWhite && result === "BLACK_WIN") || (!isWhite && result === "WHITE_WIN");
}

/**
 * Check if the game result is a draw.
 *
 * @param result - the game result
 * @returns `true` if the result is a draw
 */
export function isDrawResult(result: GameResult): boolean {
  return result === "DRAW";
}
