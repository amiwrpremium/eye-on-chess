import type { GameResult } from "@eyeonchess/chess";

const K = 32;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute new Elo ratings for both players after a game.
 * @param whiteRating - Current rating of the white player.
 * @param blackRating - Current rating of the black player.
 * @param result - The outcome of the game.
 * @returns Updated ratings for both players.
 */
export function computeElo(
  whiteRating: number,
  blackRating: number,
  result: GameResult
): { newWhiteRating: number; newBlackRating: number } {
  const expectedWhite = expectedScore(whiteRating, blackRating);
  const expectedBlack = expectedScore(blackRating, whiteRating);

  let actualWhite: number;
  let actualBlack: number;

  if (result === "WHITE_WIN") {
    actualWhite = 1;
    actualBlack = 0;
  } else if (result === "BLACK_WIN") {
    actualWhite = 0;
    actualBlack = 1;
  } else {
    actualWhite = 0.5;
    actualBlack = 0.5;
  }

  return {
    newWhiteRating: Math.round(whiteRating + K * (actualWhite - expectedWhite)),
    newBlackRating: Math.round(blackRating + K * (actualBlack - expectedBlack)),
  };
}
