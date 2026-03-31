"use client";

import { useMemo } from "react";

interface Move {
  ply: number;
  san: string;
}

interface MoveTimelineProps {
  moves: Move[];
  currentPly: number;
  totalMoves: number;
  onGoToPly: (ply: number) => void;
}

/**
 * Compact move timeline with integrated navigation for mobile.
 * Shows last few moves centered on current ply, with nav buttons at edges.
 *
 * Layout: [⏮] [◀] [moves...] [▶] [⏭]
 */
export default function MoveTimeline({
  moves,
  currentPly,
  totalMoves,
  onGoToPly,
}: MoveTimelineProps) {
  // Show up to 6 moves centered around currentPly
  const visibleMoves = useMemo(() => {
    if (moves.length === 0) return [];
    const windowSize = 6;
    let start = Math.max(0, currentPly - Math.floor(windowSize / 2));
    const end = Math.min(moves.length, start + windowSize);
    start = Math.max(0, end - windowSize);
    return moves.slice(start, end);
  }, [moves, currentPly]);

  return (
    <div className="flex items-center gap-0.5 px-0.5 py-1 bg-gray-900/80 rounded">
      <button
        onClick={() => onGoToPly(0)}
        disabled={currentPly === 0}
        className="px-1.5 py-0.5 text-gray-400 hover:text-white disabled:text-gray-700 text-sm shrink-0"
      >
        ⏮
      </button>
      <button
        onClick={() => onGoToPly(Math.max(0, currentPly - 1))}
        disabled={currentPly === 0}
        className="px-1.5 py-0.5 text-gray-400 hover:text-white disabled:text-gray-700 text-sm shrink-0"
      >
        ◀
      </button>
      <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0 text-xs font-mono overflow-hidden">
        {visibleMoves.length === 0 ? (
          <span className="text-gray-600">No moves</span>
        ) : (
          visibleMoves.map((m) => {
            const isActive = m.ply === currentPly;
            const showNum = m.ply % 2 === 1;
            return (
              <span key={m.ply} className="flex items-center shrink-0">
                {showNum && <span className="text-gray-600 mr-0.5">{Math.ceil(m.ply / 2)}.</span>}
                <button
                  onClick={() => onGoToPly(m.ply)}
                  className={`px-1 py-0.5 rounded ${
                    isActive ? "bg-blue-600 text-white" : "text-gray-400"
                  }`}
                >
                  {m.san}
                </button>
              </span>
            );
          })
        )}
      </div>
      <button
        onClick={() => onGoToPly(Math.min(totalMoves, currentPly + 1))}
        disabled={currentPly >= totalMoves}
        className="px-1.5 py-0.5 text-gray-400 hover:text-white disabled:text-gray-700 text-sm shrink-0"
      >
        ▶
      </button>
      <button
        onClick={() => onGoToPly(totalMoves)}
        disabled={currentPly >= totalMoves}
        className="px-1.5 py-0.5 text-gray-400 hover:text-white disabled:text-gray-700 text-sm shrink-0"
      >
        ⏭
      </button>
    </div>
  );
}
