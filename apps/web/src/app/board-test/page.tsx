"use client";

import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import ChessBoard from "../../components/ChessBoard";
import EvaluationBar from "../../components/EvaluationBar";
import MoveList from "../../components/MoveList";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const SAMPLE_FENS = {
  "Starting Position": STARTING_FEN,
  "Italian Game": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "Middle Game": "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7",
  Endgame: "8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 1",
  "Promotion Ready": "8/P7/8/8/8/8/8/4K2k w - - 0 1",
};

interface MoveRecord {
  ply: number;
  san: string;
  fen: string;
}

export default function BoardTestPage() {
  const [game, setGame] = useState(() => new Chess());
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [evalCP, setEvalCP] = useState<number>(0);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [showMateControl, setShowMateControl] = useState(false);

  const currentFen =
    currentPly === 0
      ? moves.length > 0
        ? STARTING_FEN
        : game.fen()
      : moves.find((m) => m.ply === currentPly)?.fen || game.fen();

  const displayFen = currentPly === moves.length ? game.fen() : currentFen;
  const isLatest = currentPly === moves.length;

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      // If browsing history, jump back to latest first
      const g = new Chess(game.fen());
      const move = g.move({ from, to, promotion: promotion || undefined });
      if (!move) return;

      const newMoveRecord: MoveRecord = {
        ply: moves.length + 1,
        san: move.san,
        fen: g.fen(),
      };

      setGame(g);
      setMoves((prev) => [...prev, newMoveRecord]);
      setCurrentPly(moves.length + 1);
      setLastMove([from, to]);
    },
    [game, moves]
  );

  function goToPly(ply: number) {
    setCurrentPly(ply);
    if (ply === 0) {
      setLastMove(undefined);
    }
  }

  function resetBoard(fen: string) {
    const g = new Chess(fen);
    setGame(g);
    setMoves([]);
    setCurrentPly(0);
    setLastMove(undefined);
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Board Component Test</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board + Eval Bar */}
          <div className="flex gap-2">
            <div className="h-auto flex">
              <EvaluationBar
                evalCP={showMateControl ? null : evalCP}
                mate={showMateControl ? mateIn : null}
              />
            </div>
            <div className="w-[min(100%,480px)]">
              <ChessBoard
                fen={displayFen}
                orientation={orientation}
                movable={isLatest}
                lastMove={lastMove}
                check={new Chess(displayFen).inCheck()}
                onMove={handleMove}
              />
            </div>
          </div>

          {/* Controls + Move List */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Move List */}
            <MoveList moves={moves} currentPly={currentPly} onGoToPly={goToPly} />

            {/* Navigation */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => goToPly(0)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                &laquo;
              </button>
              <button
                onClick={() => goToPly(Math.max(0, currentPly - 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => goToPly(Math.min(moves.length, currentPly + 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => goToPly(moves.length)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                &raquo;
              </button>
            </div>

            {/* Board Controls */}
            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400">Controls</h2>
              <button
                onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors w-full"
              >
                Flip Board ({orientation})
              </button>
            </div>

            {/* Sample Positions */}
            <div className="bg-gray-900 rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-400">Sample Positions</h2>
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(SAMPLE_FENS).map(([name, fen]) => (
                  <button
                    key={name}
                    onClick={() => resetBoard(fen)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-left transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Eval Bar Controls */}
            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400">Evaluation Bar</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showMateControl}
                  onChange={(e) => setShowMateControl(e.target.checked)}
                  className="rounded"
                />
                Show mate score
              </label>
              {showMateControl ? (
                <div>
                  <label className="text-xs text-gray-400">Mate in: {mateIn ?? 0}</label>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    value={mateIn ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setMateIn(v === 0 ? null : v);
                    }}
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-400">
                    Eval: {evalCP > 0 ? "+" : ""}
                    {(evalCP / 100).toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min={-1000}
                    max={1000}
                    value={evalCP}
                    onChange={(e) => setEvalCP(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
