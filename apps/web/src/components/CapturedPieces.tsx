"use client";

import { Chess } from "chess.js";

interface CapturedPiecesProps {
  fen: string;
  color: "white" | "black";
}

const STARTING_COUNTS: Record<string, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

const PIECE_SYMBOLS: Record<string, string> = {
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

const PIECE_ORDER = ["q", "r", "b", "n", "p"];

/**
 * Renders a row of captured piece symbols for the given color by comparing
 * the current board position against starting piece counts.
 *
 * @param props - {@link CapturedPiecesProps}
 * @returns A row of piece symbols, or null if no pieces have been captured.
 */
export default function CapturedPieces({ fen, color }: CapturedPiecesProps) {
  const chess = new Chess(fen);
  const board = chess.board();

  // Count pieces on board for the opponent
  const opponentColor = color === "white" ? "b" : "w";
  const counts: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const row of board) {
    for (const square of row) {
      if (square && square.color === opponentColor && counts[square.type] !== undefined) {
        counts[square.type]++;
      }
    }
  }

  // Captured = starting - remaining
  const captured: string[] = [];
  for (const piece of PIECE_ORDER) {
    const missing = STARTING_COUNTS[piece] - counts[piece];
    for (let i = 0; i < missing; i++) {
      captured.push(piece);
    }
  }

  if (captured.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-0.5 text-base lg:text-lg min-h-[20px] lg:min-h-[24px] overflow-hidden">
      {captured.map((p, i) => (
        <span
          key={i}
          className={
            color === "white"
              ? "text-white opacity-80 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]"
              : "text-gray-400 drop-shadow-[0_0_1px_rgba(255,255,255,0.3)]"
          }
        >
          {PIECE_SYMBOLS[p]}
        </span>
      ))}
    </div>
  );
}
