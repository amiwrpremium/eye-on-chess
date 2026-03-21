"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useEngineEval } from "../../../lib/useEngineEval";
import { lookupOpeningClient } from "../../../lib/openings";
import ChessBoard from "../../../components/ChessBoard";
import EvaluationBar from "../../../components/EvaluationBar";
import MoveList from "../../../components/MoveList";
import PlayerClock from "../../../components/PlayerClock";
import CapturedPieces from "../../../components/CapturedPieces";
import MoveFeedbackPopup from "../../../components/MoveFeedbackPopup";
import ConfirmModal from "../../../components/ConfirmModal";

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

function classifyMoveFast(fenBefore: string, fenAfter: string, moveSans: string[]): string | null {
  const opening = lookupOpeningClient(moveSans);
  if (opening) return "BOOK";

  const pieceValues: Record<string, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
  };
  function evalFen(f: string): number {
    const chess = new Chess(f);
    let score = 0;
    for (const row of chess.board()) {
      for (const sq of row) {
        if (sq) score += (sq.color === "w" ? 1 : -1) * (pieceValues[sq.type] || 0);
      }
    }
    return score;
  }
  const before = evalFen(fenBefore);
  const after = evalFen(fenAfter);
  const isWhite = fenBefore.split(" ")[1] === "w";
  const cpLoss = isWhite ? before - after : after - before;

  if (cpLoss <= 0) return null;
  if (cpLoss <= 50) return null;
  if (cpLoss <= 100) return "INACCURACY";
  if (cpLoss <= 200) return "MISTAKE";
  return "BLUNDER";
}

export default function PlayBotPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();

  // Selection
  const [phase, setPhase] = useState<"select" | "game" | "ended">("select");
  const [botElo, setBotElo] = useState(800);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [selectedPreset, setSelectedPreset] = useState("rapid_10_0");
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [customIncrement, setCustomIncrement] = useState(0);

  // Overlays
  const [showEvalBar, setShowEvalBar] = useState(true);
  const [showMoveFeedback, setShowMoveFeedback] = useState(true);
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);

  // Hint
  const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
  const [hintSource, setHintSource] = useState<string | null>(null);
  const [hintDest, setHintDest] = useState<string | null>(null);

  // Game
  const [gameId, setGameId] = useState<string | null>(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [allSans, setAllSans] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [playerIsWhite, setPlayerIsWhite] = useState(true);
  const [gameOver, setGameOver] = useState<{
    result: string;
    termination: string;
  } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [clocks, setClocks] = useState<{
    whiteTimeLeft: number;
    blackTimeLeft: number;
    turn: string;
  } | null>(null);
  const [timeControl, setTimeControl] = useState("RAPID");
  const [error, setError] = useState("");
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);

  const engineEval = useEngineEval(fen, showEvalBar && phase === "game");

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  async function startGame() {
    setError("");
    try {
      const body: Record<string, unknown> = { botElo, color: colorChoice };
      if (showCustom) {
        body.initialTime = customMinutes * 60;
        body.increment = customIncrement;
      } else {
        body.preset = selectedPreset;
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
        setAllSans([data.botFirstMove.san]);
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
      const fenBefore = fen;
      setThinking(true);
      setHintStep(0);
      setHintSource(null);
      setHintDest(null);
      try {
        const { data } = await api.post(`/api/games/${gameId}/move`, { from, to, promotion });
        if (data.playerMove) {
          const newSans = [...allSans, data.playerMove.san];
          setMoves((prev) => [
            ...prev,
            { ply: data.playerMove.ply, san: data.playerMove.san, fen: data.playerMove.fen },
          ]);
          setAllSans(newSans);
          setCurrentPly(data.playerMove.ply);
          setLastMove([from, to]);
          setFen(data.playerMove.fen);
          if (showMoveFeedback) {
            const cls = classifyMoveFast(fenBefore, data.playerMove.fen, newSans);
            setFeedback(cls);
          }
        }
        if (data.clocks) setClocks(data.clocks);
        if (data.botMove) {
          await new Promise((r) => setTimeout(r, 350));
          setMoves((prev) => [
            ...prev,
            { ply: data.botMove.ply, san: data.botMove.san, fen: data.botMove.fen },
          ]);
          setAllSans((prev) => [...prev, data.botMove.san]);
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
    [gameId, thinking, gameOver, fen, allSans, showMoveFeedback]
  );

  function handleHint() {
    if (!engineEval.bestMove) return;
    if (hintStep === 0) {
      setHintSource(engineEval.bestMove.slice(0, 2));
      setHintDest(null);
      setHintStep(1);
    } else if (hintStep === 1) {
      setHintDest(engineEval.bestMove.slice(2, 4));
      setHintStep(2);
    } else {
      setHintStep(0);
      setHintSource(null);
      setHintDest(null);
    }
  }

  async function resign() {
    if (!gameId) return;
    try {
      const { data } = await api.post(`/api/games/${gameId}/resign`);
      setGameOver(data);
      setPhase("ended");
    } catch {
      // ignore
    }
    setConfirmResign(false);
  }

  function playAgain() {
    setPhase("select");
    setGameId(null);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoves([]);
    setAllSans([]);
    setCurrentPly(0);
    setLastMove(undefined);
    setGameOver(null);
    setClocks(null);
    setFeedback(null);
    setError("");
    setHintStep(0);
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

  const arrows: { from: string; to: string; color: string }[] = [];
  if (hintStep === 2 && hintSource && hintDest) {
    arrows.push({ from: hintSource, to: hintDest, color: "green" });
  }
  const highlightedSquares: { square: string; color: string }[] = [];
  if (hintStep >= 1 && hintSource) {
    highlightedSquares.push({ square: hintSource, color: "green" });
  }

  // ── Selection Screen ─────────────────────────────────
  if (phase === "select") {
    return (
      <main className="flex flex-col items-center min-h-screen p-4 pt-12">
        <div className="max-w-lg w-full space-y-6">
          <h1 className="text-2xl font-bold text-center">Play vs Bot</h1>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

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

          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Play As</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["white", "random", "black"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setColorChoice(c)}
                  className={`py-2 rounded text-sm font-medium transition-colors ${
                    colorChoice === c ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Time Control</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setSelectedPreset(p.key);
                    setShowCustom(false);
                  }}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    !showCustom && selectedPreset === p.key
                      ? "bg-blue-600"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCustom(!showCustom)}
              className="text-sm text-blue-400 hover:underline"
            >
              {showCustom ? "Use preset" : "Custom time"}
            </button>
            {showCustom && (
              <div className="flex gap-4 mt-2">
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
            )}
          </div>

          <button
            onClick={() => setConfirmStart(true)}
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-lg font-bold transition-colors"
          >
            Start Game
          </button>

          <div className="text-center">
            <Link href="/play" className="text-gray-400 hover:text-white text-sm">
              &larr; Back to Play
            </Link>
          </div>

          <ConfirmModal
            open={confirmStart}
            title="Start Game?"
            message={`Bot: ${botElo} Elo (${eloLabel(botElo)})\nColor: ${colorChoice}\nTime: ${showCustom ? `${customMinutes}+${customIncrement}` : PRESETS.find((p) => p.key === selectedPreset)?.label || selectedPreset}`}
            confirmLabel="Start"
            confirmVariant="primary"
            onConfirm={() => {
              setConfirmStart(false);
              startGame();
            }}
            onCancel={() => setConfirmStart(false)}
          />
        </div>
      </main>
    );
  }

  // ── Game / Ended Screen ──────────────────────────────
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
    <main className="flex flex-col items-center min-h-screen p-4 pt-4">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex gap-2 flex-1 min-w-0">
            {showEvalBar && (
              <div className="h-auto flex">
                <EvaluationBar evalCP={engineEval.score} mate={null} />
              </div>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                    B
                  </div>
                  <span className="text-sm font-medium">
                    Bot ({botElo}) <span className="text-gray-500">{eloLabel(botElo)}</span>
                  </span>
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

              <div className="relative w-full max-w-[640px] border-2 border-gray-700 rounded">
                <ChessBoard
                  fen={displayFen}
                  orientation={orientation}
                  movable={isMyTurn && isViewingLatest && !gameOver}
                  lastMove={lastMove}
                  check={new Chess(displayFen).inCheck()}
                  onMove={handleMove}
                  arrows={arrows.length > 0 ? arrows : undefined}
                  highlightedSquares={
                    highlightedSquares.length > 0 ? highlightedSquares : undefined
                  }
                />
                {showMoveFeedback && <MoveFeedbackPopup classification={feedback} />}
                {thinking && (
                  <div className="absolute bottom-2 right-2 bg-gray-900/80 px-2 py-1 rounded text-xs text-gray-400">
                    Thinking...
                  </div>
                )}
              </div>

              <CapturedPieces fen={displayFen} color={playerIsWhite ? "black" : "white"} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{user.username}</span>
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

          <div className="w-full lg:w-72 space-y-3">
            <MoveList moves={moves} currentPly={currentPly} onGoToPly={setCurrentPly} />
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

            {phase === "game" && !gameOver && (
              <div className="flex gap-2">
                <button
                  onClick={handleHint}
                  disabled={!isMyTurn || !engineEval.bestMove}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                >
                  {hintStep === 0 ? "Hint" : hintStep === 1 ? "Show Move" : "Hide Hint"}
                </button>
                <button
                  onClick={() => setConfirmResign(true)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
                >
                  Resign
                </button>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setShowOverlayMenu(!showOverlayMenu)}
                className="w-full py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors"
              >
                Settings
              </button>
              {showOverlayMenu && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg p-3 z-10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={showEvalBar}
                      onChange={() => setShowEvalBar(!showEvalBar)}
                    />
                    Evaluation Bar
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={showMoveFeedback}
                      onChange={() => setShowMoveFeedback(!showMoveFeedback)}
                    />
                    Move Feedback
                  </label>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmResign}
        title="Resign?"
        message="Are you sure you want to resign this game?"
        confirmLabel="Resign"
        confirmVariant="danger"
        onConfirm={resign}
        onCancel={() => setConfirmResign(false)}
      />

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
