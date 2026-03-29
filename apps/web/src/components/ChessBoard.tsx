"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import type { Api } from "chessground/api";
import type { Key, Color as CgColor } from "chessground/types";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

interface ChessBoardProps {
  fen: string;
  orientation: "white" | "black";
  movable: boolean;
  lastMove?: [string, string];
  check?: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  highlightedSquares?: { square: string; color: string }[];
  arrows?: { from: string; to: string; color: string }[];
}

const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
const PIECE_SYMBOLS: Record<string, string> = {
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
};
const PIECE_NAMES: Record<string, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

function getLegalDests(fen: string): Map<Key, Key[]> {
  const chess = new Chess(fen);
  const dests = new Map<Key, Key[]>();
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    const from = m.from as Key;
    const existing = dests.get(from) || [];
    existing.push(m.to as Key);
    dests.set(from, existing);
  }
  return dests;
}

function getTurnColor(fen: string): CgColor {
  return fen.split(" ")[1] === "w" ? "white" : "black";
}

function isPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from as Parameters<typeof chess.get>[0]);
  if (!piece || piece.type !== "p") return false;
  const rank = to[1];
  return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
}

/**
 * Renders an interactive chessboard using Chessground, with support for legal move
 * highlighting, drag-and-drop, arrows, square highlights, and pawn promotion dialogs.
 *
 * @param props - {@link ChessBoardProps}
 * @returns The chessboard element with an optional promotion overlay.
 */
export default function ChessBoard({
  fen,
  orientation,
  movable,
  lastMove,
  check,
  onMove,
  highlightedSquares,
  arrows,
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const handleMove = useCallback(
    (from: Key, to: Key) => {
      if (isPromotion(fen, from, to)) {
        setPromotion({ from, to });
      } else {
        onMove(from, to);
      }
    },
    [fen, onMove]
  );

  // Initialize chessground
  useEffect(() => {
    if (!boardRef.current) return;
    if (apiRef.current) return;

    const turnColor = getTurnColor(fen);

    apiRef.current = Chessground(boardRef.current, {
      fen,
      orientation,
      turnColor,
      coordinates: true,
      movable: {
        free: false,
        color: movable ? turnColor : undefined,
        dests: movable ? getLegalDests(fen) : new Map(),
        showDests: true,
      },
      lastMove: lastMove as [Key, Key] | undefined,
      check: check || false,
      highlight: {
        lastMove: true,
        check: true,
      },
      animation: {
        enabled: true,
        duration: 200,
      },
      draggable: {
        enabled: movable,
        showGhost: true,
      },
      events: {
        move: handleMove,
      },
      drawable: {
        enabled: true,
        autoShapes: [
          ...(highlightedSquares || []).map((h) => ({
            orig: h.square as Key,
            brush: h.color,
          })),
          ...(arrows || []).map((a) => ({
            orig: a.from as Key,
            dest: a.to as Key,
            brush: a.color,
          })),
        ],
      },
    });

    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, []);

  // Update board state when props change
  useEffect(() => {
    if (!apiRef.current) return;

    const turnColor = getTurnColor(fen);

    apiRef.current.set({
      fen,
      orientation,
      turnColor,
      movable: {
        free: false,
        color: movable ? turnColor : undefined,
        dests: movable ? getLegalDests(fen) : new Map(),
        showDests: true,
      },
      lastMove: lastMove as [Key, Key] | undefined,
      check: check || false,
      draggable: {
        enabled: movable,
      },
      events: {
        move: handleMove,
      },
      drawable: {
        autoShapes: [
          ...(highlightedSquares || []).map((h) => ({
            orig: h.square as Key,
            brush: h.color,
          })),
          ...(arrows || []).map((a) => ({
            orig: a.from as Key,
            dest: a.to as Key,
            brush: a.color,
          })),
        ],
      },
    });
  }, [fen, orientation, movable, lastMove, check, highlightedSquares, arrows, handleMove]);

  function selectPromotion(piece: string) {
    if (promotion) {
      onMove(promotion.from, promotion.to, piece);
      setPromotion(null);
    }
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: "1/1" }}>
      <div ref={boardRef} className="w-full h-full" />
      {promotion && (
        <div
          role="dialog"
          aria-label="Choose promotion piece"
          className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"
        >
          <div className="bg-gray-800 rounded-lg p-4 flex gap-2">
            {PROMOTION_PIECES.map((p) => (
              <button
                key={p}
                onClick={() => selectPromotion(p)}
                aria-label={`Promote to ${PIECE_NAMES[p]}`}
                className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-3xl transition-colors"
              >
                {PIECE_SYMBOLS[p]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
