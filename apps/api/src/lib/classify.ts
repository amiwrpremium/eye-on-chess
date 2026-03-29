import { Chess } from "chess.js";
import { logger } from "./logger.js";
import type { MoveClassification } from "@eyeonchess/chess";

/** Result of classifying a single chess move with its evaluation data. */
export interface ClassifiedMove {
  classification: MoveClassification;
  cpLoss: number;
  evalBefore: number; // centipawns from white's perspective
  evalAfter: number;
  bestMove: string; // UCI
}

// Material values for sacrifice detection
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 0,
};

function isSacrifice(fen: string, moveUCI: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = moveUCI.slice(0, 2);
    const to = moveUCI.slice(2, 4);

    const movingPiece = chess.get(from as Parameters<typeof chess.get>[0]);
    const targetPiece = chess.get(to as Parameters<typeof chess.get>[0]);

    if (!movingPiece) return false;

    // Capture where attacker is more valuable than captured piece
    if (targetPiece) {
      const attackerValue = PIECE_VALUES[movingPiece.type] || 0;
      const capturedValue = PIECE_VALUES[targetPiece.type] || 0;
      if (attackerValue > capturedValue + 50) return true;
    }

    // Moving to an attacked square (simplified check)
    chess.move({ from, to, promotion: moveUCI[4] || undefined });
    // If the piece can be captured on the next move
    const responses = chess.moves({ verbose: true });
    const recaptures = responses.filter((m) => m.to === to);
    if (recaptures.length > 0 && !targetPiece) return true;

    return false;
  } catch (err) {
    logger.warn({ err, fen, from, to }, "hanging piece detection failed");
    return false;
  }
}

/**
 * Classify a played move by comparing engine evaluations before and after.
 * @param fen - Board position before the move.
 * @param playedMoveUCI - The move that was played in UCI format.
 * @param evalBefore - Centipawn evaluation before the move (white's perspective).
 * @param evalAfter - Centipawn evaluation after the move (white's perspective).
 * @param bestMoveUCI - The engine's best move in UCI format.
 * @param nextBestEval - Evaluation of the second-best move, or null if unavailable.
 * @returns The classified move with its category and centipawn loss.
 */
export function classifyMove(
  fen: string,
  playedMoveUCI: string,
  evalBefore: number,
  evalAfter: number,
  bestMoveUCI: string,
  nextBestEval: number | null // eval of the second-best move
): ClassifiedMove {
  const chess = new Chess(fen);
  const legalMoves = chess.moves();
  const isBlackToMove = fen.split(" ")[1] === "b";

  // Forced move: only one legal move
  if (legalMoves.length === 1) {
    return {
      classification: "FORCED",
      cpLoss: 0,
      evalBefore,
      evalAfter,
      bestMove: bestMoveUCI,
    };
  }

  // CP loss from the moving player's perspective
  let cpLoss: number;
  if (isBlackToMove) {
    // Black wants eval to go down (more negative = better for black)
    cpLoss = evalAfter - evalBefore; // positive = black lost advantage
  } else {
    // White wants eval to go up (more positive = better for white)
    cpLoss = evalBefore - evalAfter; // positive = white lost advantage
  }

  // Clamp negative cp loss to 0 (move was better than expected)
  cpLoss = Math.max(0, cpLoss);

  // Brilliant: sacrifice + cp loss < 5 + alternatives are much worse
  if (cpLoss < 5 && isSacrifice(fen, playedMoveUCI) && nextBestEval !== null) {
    let nextBestLoss: number;
    if (isBlackToMove) {
      nextBestLoss = nextBestEval - evalBefore;
    } else {
      nextBestLoss = evalBefore - nextBestEval;
    }
    if (nextBestLoss > 150) {
      return {
        classification: "BRILLIANT",
        cpLoss,
        evalBefore,
        evalAfter,
        bestMove: bestMoveUCI,
      };
    }
  }

  let classification: MoveClassification;
  if (cpLoss <= 5) classification = "GREAT";
  else if (cpLoss <= 10) classification = "BEST";
  else if (cpLoss <= 25) classification = "EXCELLENT";
  else if (cpLoss <= 50) classification = "GOOD";
  else if (cpLoss <= 100) classification = "INACCURACY";
  else if (cpLoss <= 200) classification = "MISTAKE";
  else classification = "BLUNDER";

  return {
    classification,
    cpLoss,
    evalBefore,
    evalAfter,
    bestMove: bestMoveUCI,
  };
}

/**
 * Compute overall accuracy percentage from an array of centipawn losses.
 * @param cpLosses - Array of centipawn loss values for each move.
 * @returns Accuracy as a percentage (0-100), rounded to one decimal.
 */
export function computeAccuracy(cpLosses: number[]): number {
  if (cpLosses.length === 0) return 100;
  const sum = cpLosses.reduce((acc, loss) => {
    return acc + (2 / (1 + Math.exp(0.004 * loss))) * 100;
  }, 0);
  return Math.round((sum / cpLosses.length) * 10) / 10;
}
