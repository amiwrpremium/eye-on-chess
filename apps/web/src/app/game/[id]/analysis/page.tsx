"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../../lib/api";
import { useAuthStore } from "../../../../stores/auth";
import ChessBoard from "../../../../components/ChessBoard";
import EvaluationBar from "../../../../components/EvaluationBar";
import EvalGraph from "../../../../components/EvalGraph";

interface FeedbackEntry {
  ply: number;
  san: string;
  uci: string;
  fen: string;
  classification: string;
  bestMove: string | null;
  evalBefore: number | null;
  evalAfter: number | null;
}

interface Analysis {
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  opening: { name: string; eco: string } | null;
  feedback: FeedbackEntry[];
}

interface Player {
  id: string;
  username: string;
  rating: number;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  BRILLIANT: "text-cyan-400",
  GREAT: "text-blue-400",
  BEST: "text-green-400",
  EXCELLENT: "text-green-300",
  GOOD: "text-gray-300",
  INACCURACY: "text-yellow-400",
  MISTAKE: "text-orange-400",
  BLUNDER: "text-red-400",
  FORCED: "text-gray-500",
};

const CLASSIFICATION_SYMBOLS: Record<string, string> = {
  BRILLIANT: "!!",
  GREAT: "!",
  BEST: "★",
  EXCELLENT: "●",
  GOOD: "●",
  INACCURACY: "?!",
  MISTAKE: "?",
  BLUNDER: "??",
  FORCED: "□",
};

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const { fetchMe } = useAuthStore();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [white, setWhite] = useState<Player | null>(null);
  const [black, setBlack] = useState<Player | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [startingFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const loadAnalysis = useCallback(async () => {
    try {
      const [analysisRes, gameRes] = await Promise.all([
        api.get(`/api/games/${gameId}/analysis`),
        api.get(`/api/games/${gameId}`),
      ]);

      setStatus(analysisRes.data.status);
      setAnalysis(analysisRes.data.analysis);
      setWhite(gameRes.data.game.white);
      setBlack(gameRes.data.game.black);
    } catch {
      setStatus("error");
    }
  }, [gameId]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Poll if queued or processing
  useEffect(() => {
    if (status !== "queued" && status !== "processing") return;
    const interval = setInterval(loadAnalysis, 3000);
    return () => clearInterval(interval);
  }, [status, loadAnalysis]);

  async function requestAnalysis() {
    try {
      await api.post(`/api/games/${gameId}/analyze`);
      setStatus("queued");
    } catch {
      setStatus("error");
    }
  }

  // Determine current position
  const currentFen =
    currentPly === 0
      ? startingFen
      : analysis?.feedback.find((f) => f.ply === currentPly)?.fen || startingFen;

  // Current eval
  const currentFeedback = analysis?.feedback.find((f) => f.ply === currentPly);
  const currentEval = currentFeedback?.evalAfter ?? 0;

  // Last move
  const lastMoveFeedback = analysis?.feedback.find((f) => f.ply === currentPly);
  const lastMove = lastMoveFeedback?.uci
    ? ([lastMoveFeedback.uci.slice(0, 2), lastMoveFeedback.uci.slice(2, 4)] as [string, string])
    : undefined;

  // Best move arrow for bad moves
  const showBestArrow =
    currentFeedback &&
    currentFeedback.bestMove &&
    ["INACCURACY", "MISTAKE", "BLUNDER"].includes(currentFeedback.classification);
  const bestMoveArrow =
    showBestArrow && currentFeedback?.bestMove
      ? [
          {
            from: currentFeedback.bestMove.slice(0, 2),
            to: currentFeedback.bestMove.slice(2, 4),
            color: "green",
          },
        ]
      : undefined;

  // Eval graph points
  const evalPoints =
    analysis?.feedback.map((f) => ({
      ply: f.ply,
      eval: f.evalAfter ?? 0,
      mate: null as number | null,
    })) || [];

  // Classification counts
  function countClassifications(side: "white" | "black") {
    if (!analysis) return {};
    const counts: Record<string, number> = {};
    analysis.feedback.forEach((f) => {
      const isWhite = f.ply % 2 === 1;
      if ((side === "white" && isWhite) || (side === "black" && !isWhite)) {
        counts[f.classification] = (counts[f.classification] || 0) + 1;
      }
    });
    return counts;
  }

  if (status === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (status === "none") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-4">Game Analysis</h1>
          <p className="text-gray-400 mb-6">
            No analysis available yet. Run the engine to analyze this game.
          </p>
          <button
            onClick={requestAnalysis}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
          >
            Analyze Game
          </button>
          <div className="mt-4">
            <Link href={`/game/${gameId}`} className="text-gray-400 hover:text-white text-sm">
              &larr; Back to game
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (status === "queued" || status === "processing") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-4">Analyzing...</h1>
          <p className="text-gray-400 mb-2">Stockfish is analyzing every position at depth 18.</p>
          <p className="text-gray-500 text-sm">Status: {status}. This may take a minute.</p>
        </div>
      </main>
    );
  }

  if (status === "error" || !analysis) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-400 mb-4">Analysis failed.</p>
          <button
            onClick={requestAnalysis}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const whiteCounts = countClassifications("white");
  const blackCounts = countClassifications("black");

  // Group moves into pairs for the move list
  const pairs: { num: number; white?: FeedbackEntry; black?: FeedbackEntry }[] = [];
  for (const f of analysis.feedback) {
    const num = Math.ceil(f.ply / 2);
    if (f.ply % 2 === 1) {
      pairs.push({ num, white: f });
    } else {
      if (pairs.length > 0 && pairs[pairs.length - 1].num === num) {
        pairs[pairs.length - 1].black = f;
      } else {
        pairs.push({ num, black: f });
      }
    }
  }

  return (
    <main className="min-h-screen p-4 pt-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board + Eval */}
          <div className="flex gap-2">
            <div className="h-auto flex">
              <EvaluationBar evalCP={currentEval} mate={null} />
            </div>
            <div className="w-[min(100%,480px)] space-y-2">
              <ChessBoard
                fen={currentFen}
                orientation="white"
                movable={false}
                lastMove={lastMove}
                check={false}
                onMove={() => {}}
                arrows={bestMoveArrow}
              />
              <EvalGraph points={evalPoints} currentPly={currentPly} onClickPly={setCurrentPly} />
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Opening */}
            {analysis.opening && (
              <div className="bg-gray-900 rounded-lg px-4 py-2">
                <span className="text-gray-400 text-xs">{analysis.opening.eco}</span>{" "}
                <span className="text-sm font-medium">{analysis.opening.name}</span>
              </div>
            )}

            {/* Move list with classifications */}
            <div className="bg-gray-900 rounded-lg p-3 overflow-y-auto max-h-72">
              <div className="space-y-0.5">
                {pairs.map((pair) => (
                  <div key={pair.num} className="flex items-center text-sm">
                    <span className="w-8 text-gray-500 text-right mr-2 shrink-0">{pair.num}.</span>
                    {pair.white && (
                      <button
                        onClick={() => setCurrentPly(pair.white!.ply)}
                        className={`px-2 py-0.5 rounded mr-1 min-w-[5rem] text-left font-mono transition-colors ${
                          pair.white.ply === currentPly
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        }`}
                      >
                        {pair.white.san}{" "}
                        <span
                          className={`text-xs ${
                            CLASSIFICATION_COLORS[pair.white.classification] || ""
                          }`}
                        >
                          {CLASSIFICATION_SYMBOLS[pair.white.classification] || ""}
                        </span>
                      </button>
                    )}
                    {pair.black && (
                      <button
                        onClick={() => setCurrentPly(pair.black!.ply)}
                        className={`px-2 py-0.5 rounded min-w-[5rem] text-left font-mono transition-colors ${
                          pair.black.ply === currentPly
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        }`}
                      >
                        {pair.black.san}{" "}
                        <span
                          className={`text-xs ${
                            CLASSIFICATION_COLORS[pair.black.classification] || ""
                          }`}
                        >
                          {CLASSIFICATION_SYMBOLS[pair.black.classification] || ""}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setCurrentPly(0)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &laquo;
              </button>
              <button
                onClick={() => setCurrentPly(Math.max(0, currentPly - 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => setCurrentPly(Math.min(analysis.feedback.length, currentPly + 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setCurrentPly(analysis.feedback.length)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &raquo;
              </button>
            </div>

            {/* Summary panel */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Accuracy</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">{white?.username || "White"}</p>
                  <p className="text-2xl font-bold">{analysis.whiteAccuracy?.toFixed(1) ?? "—"}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">{black?.username || "Black"}</p>
                  <p className="text-2xl font-bold">{analysis.blackAccuracy?.toFixed(1) ?? "—"}%</p>
                </div>
              </div>

              <h2 className="text-sm font-semibold text-gray-400 mb-2">Move Classifications</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {[
                  "BRILLIANT",
                  "GREAT",
                  "BEST",
                  "EXCELLENT",
                  "GOOD",
                  "INACCURACY",
                  "MISTAKE",
                  "BLUNDER",
                ].map((cls) => (
                  <div key={cls} className="flex justify-between">
                    <span className={CLASSIFICATION_COLORS[cls]}>
                      {CLASSIFICATION_SYMBOLS[cls]} {cls.charAt(0) + cls.slice(1).toLowerCase()}
                    </span>
                    <span className="text-gray-400">
                      {whiteCounts[cls] || 0} / {blackCounts[cls] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Link href={`/game/${gameId}`} className="text-gray-400 hover:text-white text-sm">
                &larr; Back to game
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
