"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useEngineEval } from "../../../lib/useEngineEval";
import ChessBoard from "../../../components/ChessBoard";
import EvaluationBar from "../../../components/EvaluationBar";
import MoveList from "../../../components/MoveList";
import PlayerClock from "../../../components/PlayerClock";
import CapturedPieces from "../../../components/CapturedPieces";
import MoveFeedbackPopup from "../../../components/MoveFeedbackPopup";
import OverlayControls, { useOverlaySettings } from "../../../components/OverlayControls";

interface MoveRecord {
  ply: number;
  san: string;
  fen: string;
}

const PRESETS = [
  { label: "1+0", key: "bullet_1_0" },
  { label: "3+2", key: "blitz_3_2" },
  { label: "5+0", key: "blitz_5_0" },
  { label: "10+0", key: "rapid_10_0" },
  { label: "Unlimited", key: "unlimited" },
];

function eloLabel(elo: number): string {
  if (elo < 400) return "Beginner";
  if (elo < 800) return "Novice";
  if (elo < 1200) return "Intermediate";
  if (elo < 1600) return "Advanced";
  if (elo < 2000) return "Expert";
  if (elo < 2400) return "Master";
  if (elo < 2800) return "Grandmaster";
  return "Engine";
}

// Simple client-side move classification by material change
function classifyMoveFast(
  scoreBefore: number,
  scoreAfter: number,
  isWhite: boolean
): string | null {
  const cpLoss = isWhite ? scoreBefore - scoreAfter : scoreAfter - scoreBefore;
  if (cpLoss < 0) return null; // Move improved position
  if (cpLoss <= 10) return null; // Good enough
  if (cpLoss <= 50) return "GOOD";
  if (cpLoss <= 100) return "INACCURACY";
  if (cpLoss <= 200) return "MISTAKE";
  if (cpLoss > 200) return "BLUNDER";
  return null;
}

export default function PlayBotPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const overlay = useOverlaySettings();

  // Selection state
  const [phase, setPhase] = useState<"select" | "game" | "ended">("select");
  const [botElo, setBotElo] = useState(800);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [selectedPreset, setSelectedPreset] = useState("rapid_10_0");
  const [customMinutes, setCustomMinutes] = useState(10);
  const [customIncrement, setCustomIncrement] = useState(0);
  const [showCustom, setShowCustom] = useState(false);

  // Game state
  const [gameId, setGameId] = useState<string | null>(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [playerIsWhite, setPlayerIsWhite] = useState(true);
  const [gameOver, setGameOver] = useState<{ result: string; termination: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [clocks, setClocks] = useState<{
    whiteTimeLeft: number;
    blackTimeLeft: number;
    turn: string;
  } | null>(null);
  const [timeControl, setTimeControl] = useState("RAPID");
  const [error, setError] = useState("");

  // Engine eval for overlays
  const evalEnabled =
    overlay.settings.evalBar ||
    overlay.settings.bestMove ||
    overlay.settings.threats ||
    overlay.settings.hints;
  const engineEval = useEngineEval(fen, evalEnabled && phase === "game");
  const prevScoreRef = useState<number>(0);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  async function startGame(preset?: string) {
    setError("");
    try {
      const body: Record<string, unknown> = { botElo, color: colorChoice };
      if (preset) {
        body.preset = preset;
      } else {
        body.initialTime = customMinutes * 60;
        body.increment = customIncrement;
      }
      const { data } = await api.post("/api/games/bot", body);
      setGameId(data.game.id);
      setPlayerIsWhite(data.playerIsWhite);
      setTimeControl(data.game.timeControl);
      setClocks({
        whiteTimeLeft: data.game.whiteTimeLeft,
        blackTimeLeft: data.game.blackTimeLeft,
        turn: "white",
      });

      if (data.botFirstMove) {
        setFen(data.botFirstMove.fen);
        setMoves([{ ply: 1, san: data.botFirstMove.san, fen: data.botFirstMove.fen }]);
        setCurrentPly(1);
        setLastMove([data.botFirstMove.from, data.botFirstMove.to]);
      } else {
        setFen(data.game.fen);
      }

      setPhase("game");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to start game";
      setError(msg);
    }
  }

  const handleMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (!gameId || thinking || gameOver) return;

      const scoreBefore = engineEval.score;
      setThinking(true);

      try {
        const { data } = await api.post(`/api/games/${gameId}/move`, { from, to, promotion });

        // Apply player move
        if (data.playerMove) {
          setMoves((prev) => [
            ...prev,
            { ply: data.playerMove.ply, san: data.playerMove.san, fen: data.playerMove.fen },
          ]);
          setCurrentPly(data.playerMove.ply);
          setLastMove([from, to]);
          setFen(data.playerMove.fen);
        }

        if (data.clocks) setClocks(data.clocks);

        // Move feedback
        if (overlay.settings.moveFeedback && data.playerMove) {
          const scoreAfter = engineEval.score; // Will update on next render
          const cls = classifyMoveFast(scoreBefore, scoreAfter, playerIsWhite);
          if (cls) setFeedback(cls);
          else setFeedback(null);
        }

        // Apply bot move after a small delay
        if (data.botMove) {
          await new Promise((r) => setTimeout(r, 300));
          setMoves((prev) => [
            ...prev,
            { ply: data.botMove.ply, san: data.botMove.san, fen: data.botMove.fen },
          ]);
          setCurrentPly(data.botMove.ply);
          setLastMove([data.botMove.from, data.botMove.to]);
          setFen(data.botMove.fen);
          if (data.clocks) setClocks(data.clocks);
        }

        if (data.gameOver) {
          setGameOver(data.gameOver);
          setPhase("ended");
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Move failed";
        setError(msg);
      } finally {
        setThinking(false);
      }
    },
    [gameId, thinking, gameOver, engineEval.score, overlay.settings.moveFeedback, playerIsWhite]
  );

  async function resign() {
    if (!gameId) return;
    try {
      const { data } = await api.post(`/api/games/${gameId}/resign`);
      setGameOver(data);
      setPhase("ended");
    } catch {
      // ignore
    }
  }

  function playAgain() {
    setPhase("select");
    setGameId(null);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoves([]);
    setCurrentPly(0);
    setLastMove(undefined);
    setGameOver(null);
    setClocks(null);
    setFeedback(null);
    setError("");
  }

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const orientation = playerIsWhite ? "white" : "black";
  const isMyTurn =
    phase === "game" &&
    !thinking &&
    !gameOver &&
    ((fen.split(" ")[1] === "w" && playerIsWhite) || (fen.split(" ")[1] === "b" && !playerIsWhite));
  const isViewingLatest = currentPly === moves.length;
  const displayFen =
    currentPly === 0
      ? moves.length > 0
        ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        : fen
      : moves.find((m) => m.ply === currentPly)?.fen || fen;
  const isUnlimited = timeControl === "UNLIMITED";

  // Build overlays
  const arrows: { from: string; to: string; color: string }[] = [];
  if (overlay.settings.bestMove && engineEval.bestMove && phase === "game") {
    arrows.push({
      from: engineEval.bestMove.slice(0, 2),
      to: engineEval.bestMove.slice(2, 4),
      color: "green",
    });
  }
  if (overlay.settings.threats && engineEval.threats.length > 0 && phase === "game") {
    for (const t of engineEval.threats) {
      arrows.push({ from: t.slice(0, 2), to: t.slice(2, 4), color: "red" });
    }
  }
  const highlightedSquares: { square: string; color: string }[] = [];
  if (overlay.settings.hints && engineEval.topMoves.length > 0 && phase === "game") {
    for (const m of engineEval.topMoves) {
      highlightedSquares.push({ square: m.slice(2, 4), color: "blue" });
    }
  }

  // ── Selection Screen ──────────────────────────────────
  if (phase === "select") {
    return (
      <main className="flex flex-col items-center min-h-screen p-4 pt-12">
        <div className="max-w-lg w-full space-y-6">
          <h1 className="text-2xl font-bold text-center">Play vs Bot</h1>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {/* Elo Slider */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">Bot Difficulty</h2>
            <div className="text-center mb-2">
              <span className="text-3xl font-bold">{botElo}</span>
              <span className="text-gray-400 ml-2">{eloLabel(botElo)}</span>
            </div>
            <input
              type="range"
              min={200}
              max={3200}
              step={50}
              value={botElo}
              onChange={(e) => setBotElo(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>200</span>
              <span>3200</span>
            </div>
          </div>

          {/* Color */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Play As</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["white", "random", "black"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setColorChoice(c)}
                  className={`py-2 rounded text-sm font-medium transition-colors ${colorChoice === c ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
                >
                  {c === "white" ? "White" : c === "black" ? "Black" : "Random"}
                </button>
              ))}
            </div>
          </div>

          {/* Time Control */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Time Control</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setSelectedPreset(p.key);
                    setShowCustom(false);
                    startGame(p.key);
                  }}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCustom(!showCustom)}
              className="text-sm text-blue-400 hover:underline"
            >
              {showCustom ? "Hide custom" : "Custom time"}
            </button>
            {showCustom && (
              <div className="space-y-3 mt-2">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Minutes</label>
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Increment (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={customIncrement}
                      onChange={(e) => setCustomIncrement(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => startGame()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-sm transition-colors"
                >
                  Start {customMinutes}+{customIncrement}
                </button>
              </div>
            )}
          </div>

          {/* Overlays */}
          <OverlayControls settings={overlay.settings} onChange={overlay.update} />

          <div className="text-center">
            <Link href="/play" className="text-gray-400 hover:text-white text-sm">
              &larr; Back to Play
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Game Screen ───────────────────────────────────────
  const resultLabels: Record<string, string> = {
    WHITE_WIN: "White wins",
    BLACK_WIN: "Black wins",
    DRAW: "Draw",
  };
  const termLabels: Record<string, string> = {
    CHECKMATE: "by checkmate",
    RESIGNATION: "by resignation",
    TIMEOUT: "on time",
    AGREEMENT: "by agreement",
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-8">
      <div className="max-w-5xl w-full">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board column */}
          <div className="flex gap-2">
            {overlay.settings.evalBar && (
              <div className="h-auto flex">
                <EvaluationBar evalCP={engineEval.score} mate={null} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {/* Top: opponent captured pieces + clock */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                    B
                  </div>
                  <div>
                    <span className="font-medium text-sm">Bot ({botElo})</span>
                    <span className="text-gray-400 text-xs ml-1">{eloLabel(botElo)}</span>
                  </div>
                </div>
                {!isUnlimited && clocks && (
                  <PlayerClock
                    timeMs={playerIsWhite ? clocks.blackTimeLeft : clocks.whiteTimeLeft}
                    isActive={!isMyTurn && phase === "game"}
                    isRunning={phase === "game" && !gameOver}
                  />
                )}
              </div>
              <CapturedPieces fen={displayFen} color={playerIsWhite ? "white" : "black"} />

              {/* Board */}
              <div className="relative w-[min(100%,480px)]">
                <ChessBoard
                  fen={displayFen}
                  orientation={orientation}
                  movable={isMyTurn && isViewingLatest && !gameOver}
                  lastMove={lastMove}
                  check={false}
                  onMove={handleMove}
                  arrows={arrows.length > 0 ? arrows : undefined}
                  highlightedSquares={
                    highlightedSquares.length > 0 ? highlightedSquares : undefined
                  }
                />
                {overlay.settings.moveFeedback && <MoveFeedbackPopup classification={feedback} />}
                {thinking && (
                  <div className="absolute bottom-2 right-2 bg-gray-900/80 px-2 py-1 rounded text-xs text-gray-400">
                    Bot thinking...
                  </div>
                )}
              </div>

              <CapturedPieces fen={displayFen} color={playerIsWhite ? "black" : "white"} />
              {/* Bottom: player info + clock */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{user.username}</span>
                </div>
                {!isUnlimited && clocks && (
                  <PlayerClock
                    timeMs={playerIsWhite ? clocks.whiteTimeLeft : clocks.blackTimeLeft}
                    isActive={isMyTurn}
                    isRunning={phase === "game" && !gameOver}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 space-y-4 min-w-0">
            <MoveList moves={moves} currentPly={currentPly} onGoToPly={setCurrentPly} />

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
                onClick={() => setCurrentPly(Math.min(moves.length, currentPly + 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setCurrentPly(moves.length)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &raquo;
              </button>
            </div>

            {/* Game actions */}
            {phase === "game" && !gameOver && (
              <button
                onClick={resign}
                className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
              >
                Resign
              </button>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            {/* Overlays toggle (in-game) */}
            <OverlayControls settings={overlay.settings} onChange={overlay.update} />
          </div>
        </div>
      </div>

      {/* Game over modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-xl font-bold mb-2">Game Over</h2>
            <p className="text-gray-300 mb-4">
              {resultLabels[gameOver.result] || gameOver.result}{" "}
              {termLabels[gameOver.termination] || ""}
            </p>
            <div className="flex gap-3">
              <button
                onClick={playAgain}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
              >
                Play Again
              </button>
              {gameId && (
                <button
                  onClick={() => router.push(`/game/${gameId}/analysis`)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                >
                  Analyze
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
