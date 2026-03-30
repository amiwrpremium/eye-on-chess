import { Chess } from "chess.js";
import type { MoveClassification } from "../moves/types";

/** Result of classifying a single chess move with its evaluation data. */
export interface ClassifiedMove {
  classification: MoveClassification;
  cpLoss: number;
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
}

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

    if (targetPiece) {
      const attackerValue = PIECE_VALUES[movingPiece.type] || 0;
      const capturedValue = PIECE_VALUES[targetPiece.type] || 0;
      if (attackerValue > capturedValue + 50) return true;
    }

    chess.move({ from, to, promotion: moveUCI[4] || undefined });
    const responses = chess.moves({ verbose: true });
    const recaptures = responses.filter((m) => m.to === to);
    if (recaptures.length > 0 && !targetPiece) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Classify a played move by comparing engine evaluations before and after.
 *
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
  nextBestEval: number | null
): ClassifiedMove {
  const chess = new Chess(fen);
  const legalMoves = chess.moves();
  const isBlackToMove = fen.split(" ")[1] === "b";

  if (legalMoves.length === 1) {
    return {
      classification: "FORCED",
      cpLoss: 0,
      evalBefore,
      evalAfter,
      bestMove: bestMoveUCI,
    };
  }

  let cpLoss: number;
  if (isBlackToMove) {
    cpLoss = evalAfter - evalBefore;
  } else {
    cpLoss = evalBefore - evalAfter;
  }
  cpLoss = Math.max(0, cpLoss);

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
 *
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
