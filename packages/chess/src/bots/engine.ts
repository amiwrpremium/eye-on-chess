import { Chess } from "chess.js";
import type { BotPersonality, StockfishBotConfig } from "./types";

// ── Piece-square tables for positional evaluation ────────

const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
  25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
  10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
  -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
  -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
  0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5,
  5, 0, 0, 0,
];

const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5,
  0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0,
  -10, -20, -10, -10, -5, -5, -10, -10, -20,
];

const PST_KING = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
  -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
  10, 30, 20,
];

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const PST_MAP: Record<string, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING,
};

function evaluateBoard(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const pst = PST_MAP[sq.type] || [];
      const idx = sq.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
      const val = (PIECE_VALUES[sq.type] || 0) + (pst[idx] || 0);
      score += sq.color === "w" ? val : -val;
    }
  }
  return score;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, isMax: boolean): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves();
  if (isMax) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/**
 * Compute a move for a custom-tier bot (200-1200 Elo) using JS minimax
 * with personality quirks applied.
 *
 * @param fen - current board position
 * @param personality - the bot's behavior profile
 * @returns UCI move string (e.g. "e2e4")
 */
export function computeCustomMove(fen: string, personality: BotPersonality): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) return null;

  const moveCount = chess.moveNumber();
  const isWhite = chess.turn() === "w";

  // Random move chance
  if (Math.random() < personality.randomMoveChance) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return `${m.from}${m.to}${m.promotion || ""}`;
  }

  // Queen early quirk — if queen hasn't moved in first 5 moves, move it
  if (personality.queenEarly && moveCount <= 5) {
    const queenMoves = moves.filter((m) => m.piece === "q");
    if (queenMoves.length > 0 && Math.random() < 0.6) {
      const m = queenMoves[Math.floor(Math.random() * queenMoves.length)];
      return `${m.from}${m.to}${m.promotion || ""}`;
    }
  }

  // Pawn pusher quirk — prefer pawn moves on edges
  if (personality.pawnPusher && Math.random() < 0.4) {
    const edgePawnMoves = moves.filter(
      (m) =>
        m.piece === "p" &&
        (m.from[0] === "a" || m.from[0] === "h" || m.to[0] === "a" || m.to[0] === "h")
    );
    if (edgePawnMoves.length > 0) {
      const m = edgePawnMoves[Math.floor(Math.random() * edgePawnMoves.length)];
      return `${m.from}${m.to}${m.promotion || ""}`;
    }
  }

  // Score all moves using minimax + personality biases
  const scored = moves.map((m) => {
    chess.move(m);
    let score = minimax(chess, personality.maxDepth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    // Flip score for black
    if (!isWhite) score = -score;

    // Capture greed bias
    if (m.captured && Math.random() < personality.captureGreed) {
      score += 200;
    }

    // Aggression bias — prefer moves toward enemy king area
    if (personality.aggressionBias > 0) {
      const targetRank = isWhite ? 7 : 0;
      const moveRank = parseInt(m.to[1]) - 1;
      const closeness = 7 - Math.abs(targetRank - moveRank);
      score += closeness * personality.aggressionBias * 15;
    } else if (personality.aggressionBias < 0) {
      // Defensive — prefer retreating moves
      const homeRank = isWhite ? 0 : 7;
      const moveRank = parseInt(m.to[1]) - 1;
      const closeness = 7 - Math.abs(homeRank - moveRank);
      score += closeness * Math.abs(personality.aggressionBias) * 10;
    }

    return { move: m, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Blunder chance — pick a move from the bottom half
  if (scored.length > 2 && Math.random() < personality.blunderChance) {
    const bottomHalf = scored.slice(Math.floor(scored.length / 2));
    const m = bottomHalf[Math.floor(Math.random() * bottomHalf.length)].move;
    return `${m.from}${m.to}${m.promotion || ""}`;
  }

  // Pick from top 3 with some randomness for lower elo
  const topN = Math.min(3, scored.length);
  const pickIdx = Math.floor(Math.random() * topN);
  const pick = scored[pickIdx].move;
  return `${pick.from}${pick.to}${pick.promotion || ""}`;
}

/**
 * Get Stockfish configuration for hybrid and engine tier bots.
 *
 * @param personality - the bot's behavior profile
 * @returns configuration for the Stockfish call
 */
export function getStockfishConfig(personality: BotPersonality): StockfishBotConfig {
  if (personality.tier === "engine") {
    return {
      depth: personality.maxDepth,
      blunderChance: 0,
      uciElo: personality.elo,
      thinkTime: Math.max(500, Math.floor(personality.elo / 3)),
    };
  }

  // Hybrid tier
  return {
    depth: personality.maxDepth,
    blunderChance: personality.blunderChance,
    uciElo: 0, // not used for hybrid
    thinkTime: Math.max(300, Math.floor(personality.elo / 4)),
  };
}
