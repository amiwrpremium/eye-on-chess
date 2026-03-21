"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

interface EngineEval {
  score: number; // centipawns from white's perspective
  bestMove: string | null; // UCI format
  topMoves: string[]; // top 3 UCI moves
  threats: string[]; // opponent's best responses
}

// Lightweight client-side position evaluation using chess.js
// For real analysis, use the server-side Stockfish analysis pipeline
function evaluatePosition(fen: string): EngineEval {
  const chess = new Chess(fen);
  const isWhite = chess.turn() === "w";
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) {
    if (chess.isCheckmate()) {
      return { score: isWhite ? -100000 : 100000, bestMove: null, topMoves: [], threats: [] };
    }
    return { score: 0, bestMove: null, topMoves: [], threats: [] }; // stalemate
  }

  // Material count
  const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const board = chess.board();
  let material = 0;
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        const val = pieceValues[sq.type] || 0;
        material += sq.color === "w" ? val : -val;
      }
    }
  }

  // Simple move scoring: captures, checks, center control
  const scored = moves.map((m) => {
    let moveScore = 0;
    if (m.captured) moveScore += pieceValues[m.captured] || 50;
    // Simulate move and check
    const testChess = new Chess(fen);
    testChess.move(m);
    if (testChess.inCheck()) moveScore += 50;
    // Center control bonus
    if (["d4", "d5", "e4", "e5"].includes(m.to)) moveScore += 20;
    if (["c3", "c6", "f3", "f6", "d3", "d6", "e3", "e6"].includes(m.to)) moveScore += 10;
    return { move: m, score: moveScore };
  });

  scored.sort((a, b) => b.score - a.score);

  const topMoves = scored
    .slice(0, 3)
    .map((s) => `${s.move.from}${s.move.to}${s.move.promotion || ""}`);
  const bestMove = topMoves[0] || null;

  // Get threats: opponent's best moves after a null-ish move
  const threats: string[] = [];
  if (scored.length > 0) {
    const afterBest = new Chess(fen);
    afterBest.move(scored[0].move);
    const opponentMoves = afterBest.moves({ verbose: true });
    const opScored = opponentMoves
      .map((m) => {
        let s = 0;
        if (m.captured) s += pieceValues[m.captured] || 50;
        return { move: m, score: s };
      })
      .sort((a, b) => b.score - a.score);

    threats.push(...opScored.slice(0, 2).map((s) => `${s.move.from}${s.move.to}`));
  }

  return { score: material, bestMove, topMoves, threats };
}

export function useEngineEval(fen: string, enabled: boolean) {
  const [eval_, setEval] = useState<EngineEval>({
    score: 0,
    bestMove: null,
    topMoves: [],
    threats: [],
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) return;

    // Debounce to avoid computing on every render
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = evaluatePosition(fen);
      setEval(result);
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fen, enabled]);

  return eval_;
}
