"use client";

import { useRef, useEffect } from "react";

interface Move {
  ply: number;
  san: string;
}

interface MoveTimelineProps {
  moves: Move[];
  currentPly: number;
  onGoToPly: (ply: number) => void;
}

/**
 * Compact horizontal scrollable move timeline for mobile.
 * Shows moves inline: 1.e4 e5 2.Nf3 Nc6...
 * Auto-scrolls to keep the current ply visible.
 */
export default function MoveTimeline({ moves, currentPly, onGoToPly }: MoveTimelineProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentPly]);

  if (moves.length === 0) {
    return <div className="text-xs text-gray-500 text-center py-1">No moves yet</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 bg-gray-900/80 rounded text-xs font-mono scrollbar-none"
    >
      {moves.map((m) => {
        const isActive = m.ply === currentPly;
        const showNumber = m.ply % 2 === 1;
        return (
          <span key={m.ply} className="flex items-center shrink-0">
            {showNumber && <span className="text-gray-600 mr-0.5">{Math.ceil(m.ply / 2)}.</span>}
            <button
              ref={isActive ? activeRef : undefined}
              onClick={() => onGoToPly(m.ply)}
              className={`px-1 py-0.5 rounded transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {m.san}
            </button>
          </span>
        );
      })}
    </div>
  );
}
