"use client";

import { useMemo } from "react";
import { Chess } from "chess.js";
import type { EngineLine } from "../lib/useStockfish";

interface EngineLinesProps {
  lines: EngineLine[];
  fen: string;
  loading?: boolean;
}

const RANK_COLORS = ["bg-green-600", "bg-yellow-600", "bg-orange-600"];

function formatScore(score: number, mate: number | null): string {
  if (mate !== null) {
    return `M${mate > 0 ? "" : "-"}${Math.abs(mate)}`;
  }
  return `${score > 0 ? "+" : ""}${(score / 100).toFixed(1)}`;
}

function uciToSan(fen: string, uciMoves: string[]): string {
  try {
    const chess = new Chess(fen);
    const sanMoves: string[] = [];
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion });
      if (!move) break;
      sanMoves.push(move.san);
    }
    return formatMoveSequence(sanMoves, fen);
  } catch {
    return uciMoves.slice(0, 8).join(" ");
  }
}

function formatMoveSequence(sanMoves: string[], fen: string): string {
  const parts = fen.split(" ");
  let moveNum = parseInt(parts[5]) || 1;
  const isBlackFirst = parts[1] === "b";
  const result: string[] = [];

  for (let i = 0; i < sanMoves.length && i < 12; i++) {
    const isWhiteMove = isBlackFirst ? i % 2 === 1 : i % 2 === 0;
    if (isWhiteMove) {
      result.push(`${moveNum}.\u00A0${sanMoves[i]}`);
    } else {
      if (i === 0 && isBlackFirst) {
        result.push(`${moveNum}...\u00A0${sanMoves[i]}`);
      } else {
        result.push(sanMoves[i]);
      }
      moveNum++;
    }
  }
  return result.join(" ");
}

/**
 * Renders multiple engine principal variations in a chess.com-style panel.
 * Each line shows rank indicator, evaluation score, and SAN move sequence.
 */
export default function EngineLines({ lines, fen, loading }: EngineLinesProps) {
  const formattedLines = useMemo(
    () =>
      lines.map((line, i) => ({
        rank: i + 1,
        scoreStr: formatScore(line.score, line.mate),
        moves: uciToSan(fen, line.pv),
        score: line.score,
        mate: line.mate,
      })),
    [lines, fen]
  );

  if (formattedLines.length === 0) {
    if (!loading) return null;
    return (
      <div className="bg-gray-900 rounded-lg overflow-hidden text-xs font-mono">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 last:border-0"
          >
            <span className="w-5 h-5 rounded bg-gray-700 animate-pulse shrink-0" />
            <span className="w-12 h-4 rounded bg-gray-700 animate-pulse shrink-0" />
            <span className="flex-1 h-4 rounded bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden text-xs font-mono">
      {formattedLines.map((line) => (
        <div
          key={line.rank}
          className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 last:border-0"
        >
          <span
            className={`w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0 ${
              RANK_COLORS[line.rank - 1] || "bg-gray-600"
            }`}
          >
            {line.rank}
          </span>
          <span
            className={`w-12 text-right font-bold shrink-0 ${
              line.mate !== null
                ? "text-red-400"
                : line.score > 50
                  ? "text-green-400"
                  : line.score < -50
                    ? "text-red-400"
                    : "text-gray-300"
            }`}
          >
            {line.scoreStr}
          </span>
          <span className="text-gray-400 truncate">{line.moves}</span>
        </div>
      ))}
    </div>
  );
}
