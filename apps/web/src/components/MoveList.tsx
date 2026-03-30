"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Move {
  ply: number;
  san: string;
}

interface MoveListProps {
  moves: Move[];
  currentPly: number;
  onGoToPly: (ply: number) => void;
  onMoveHover?: (ply: number) => void;
  onMoveHoverEnd?: () => void;
}

/**
 * Renders a scrollable list of chess moves grouped into numbered pairs (white/black),
 * with the current ply highlighted and auto-scrolling into view.
 * Supports optional hover callbacks for move preview on the board.
 * Shows a "New moves" indicator when scrolled away from the latest move.
 *
 * @param props - {@link MoveListProps}
 * @returns The move list panel, or a "No moves yet" placeholder when empty.
 */
export default function MoveList({
  moves,
  currentPly,
  onGoToPly,
  onMoveHover,
  onMoveHoverEnd,
}: MoveListProps) {
  const currentRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNewMoves, setShowNewMoves] = useState(false);

  useEffect(() => {
    if (currentRef.current && containerRef.current) {
      currentRef.current.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentPly]);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setShowNewMoves(!isAtBottom && moves.length > 0);
  }, [moves.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  // Re-check when moves change (new move added while scrolled up)
  useEffect(() => {
    checkScroll();
  }, [moves.length, checkScroll]);

  // Group moves into pairs (white, black)
  const pairs: { moveNumber: number; white?: Move; black?: Move }[] = [];
  for (const move of moves) {
    const moveNumber = Math.ceil(move.ply / 2);
    if (move.ply % 2 === 1) {
      // White move (odd ply)
      pairs.push({ moveNumber, white: move });
    } else {
      // Black move (even ply)
      if (pairs.length > 0 && pairs[pairs.length - 1].moveNumber === moveNumber) {
        pairs[pairs.length - 1].black = move;
      } else {
        pairs.push({ moveNumber, black: move });
      }
    }
  }

  if (moves.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 text-gray-500 text-sm text-center">
        No moves yet
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="bg-gray-900 rounded-lg p-3 overflow-y-auto max-h-80">
        <div className="space-y-0.5">
          {pairs.map((pair) => (
            <div key={pair.moveNumber} className="flex items-center text-sm">
              <span className="w-8 text-gray-500 text-right mr-2 shrink-0">
                {pair.moveNumber}.
              </span>
              {pair.white && (
                <button
                  ref={pair.white.ply === currentPly ? currentRef : undefined}
                  onClick={() => onGoToPly(pair.white!.ply)}
                  onMouseEnter={() => onMoveHover?.(pair.white!.ply)}
                  onMouseLeave={() => onMoveHoverEnd?.()}
                  className={`px-2 py-0.5 rounded mr-1 min-w-[4rem] text-left font-mono transition-colors ${
                    pair.white.ply === currentPly
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-800 text-gray-300"
                  }`}
                >
                  {pair.white.san}
                </button>
              )}
              {pair.black && (
                <button
                  ref={pair.black.ply === currentPly ? currentRef : undefined}
                  onClick={() => onGoToPly(pair.black!.ply)}
                  onMouseEnter={() => onMoveHover?.(pair.black!.ply)}
                  onMouseLeave={() => onMoveHoverEnd?.()}
                  className={`px-2 py-0.5 rounded min-w-[4rem] text-left font-mono transition-colors ${
                    pair.black.ply === currentPly
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-800 text-gray-300"
                  }`}
                >
                  {pair.black.san}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {showNewMoves && (
        <button
          onClick={() => {
            const el = containerRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-full text-xs font-medium shadow-lg transition-colors animate-pulse"
        >
          New moves ↓
        </button>
      )}
    </div>
  );
}
