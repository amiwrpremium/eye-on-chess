"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useStockfish } from "../../../lib/useStockfish";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import {
  saveOfflineGame,
  syncOfflineGames,
  generateOfflineGameId,
  getPendingCount,
} from "../../../lib/offlineSync";
import { lookupOpeningClient } from "../../../lib/openings";
import ChessBoard from "../../../components/ChessBoard";
import EvaluationBar from "../../../components/EvaluationBar";
import MoveList from "../../../components/MoveList";
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
  const pv: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  function ev(f: string): number {
    const c = new Chess(f);
    let s = 0;
    for (const row of c.board())
      for (const sq of row) if (sq) s += (sq.color === "w" ? 1 : -1) * (pv[sq.type] || 0);
    return s;
  }
  const before = ev(fenBefore);
  const after = ev(fenAfter);
  const isWhite = fenBefore.split(" ")[1] === "w";
  const cpLoss = isWhite ? before - after : after - before;
  if (cpLoss <= 50) return null;
  if (cpLoss <= 100) return "INACCURACY";
  if (cpLoss <= 200) return "MISTAKE";
  return "BLUNDER";
}

export default function PlayBotPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const stockfish = useStockfish();
  const isOnline = useOnlineStatus();

  // Selection
  const [phase, setPhase] = useState<"select" | "game" | "ended">("select");
  const [botElo, setBotElo] = useState(800);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [selectedPreset, setSelectedPreset] = useState("unlimited");
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

  // Game state (all client-side via chess.js + stockfish wasm)
  const [gameId, setGameId] = useState<string | null>(null); // server game id (if online)
  const [game, setGame] = useState(() => new Chess());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [allSans, setAllSans] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [playerIsWhite, setPlayerIsWhite] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evalScore, setEvalScore] = useState(0);
  const [error, setError] = useState("");
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);

  // Active game check
  const [activeGame, setActiveGame] = useState<{
    id: string;
    botElo: number | null;
  } | null>(null);
  const [showActivePrompt, setShowActivePrompt] = useState(false);
  const [offlineGameId, setOfflineGameId] = useState<string | null>(null);
  const [allUciMoves, setAllUciMoves] = useState<string[]>([]); // track uci for sync
  const [gameStartTime, setGameStartTime] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // Sync offline games when connection returns
  useEffect(() => {
    setPendingSyncCount(getPendingCount());
    if (!isOnline) return;
    syncOfflineGames().then((synced) => {
      if (synced > 0) setPendingSyncCount(getPendingCount());
    });
  }, [isOnline]);

  // Check for active game on mount (only when online)
  useEffect(() => {
    if (!user || phase !== "select" || !isOnline) return;
    async function checkActive() {
      try {
        const { data } = await api.get("/api/games/active");
        if (data.game && data.game.isVsBot) {
          setActiveGame(data.game);
          setShowActivePrompt(true);
        }
      } catch {
        // offline or error — ignore
      }
    }
    checkActive();
  }, [user, phase, isOnline]);

  async function resumeGame() {
    if (!activeGame) return;
    try {
      const { data } = await api.get(`/api/games/${activeGame.id}`);
      const g = data.game;
      const chess = new Chess(g.fen);
      setGame(chess);
      setGameId(g.id);
      setPlayerIsWhite(g.whiteId === user?.id);
      setBotElo(g.botElo || 800);
      if (g.moves && g.moves.length > 0) {
        const records = g.moves.map((m: { ply: number; san: string; fen: string }) => ({
          ply: m.ply,
          san: m.san,
          fen: m.fen,
        }));
        setMoves(records);
        setAllSans(g.moves.map((m: { san: string }) => m.san));
        setCurrentPly(records.length);
        const last = g.moves[g.moves.length - 1];
        if (last.uci && last.uci.length >= 4)
          setLastMove([last.uci.slice(0, 2), last.uci.slice(2, 4)]);
      }
      setPhase("game");
      setShowActivePrompt(false);
    } catch {
      setShowActivePrompt(false);
    }
  }

  async function resignActiveAndContinue() {
    if (!activeGame) return;
    try {
      await api.post(`/api/games/${activeGame.id}/resign`);
    } catch {
      // ignore
    }
    setActiveGame(null);
    setShowActivePrompt(false);
  }

  async function startGame() {
    setError("");
    setConfirmStart(false);

    const isWhite =
      colorChoice === "white" ? true : colorChoice === "black" ? false : Math.random() < 0.5;
    const chess = new Chess();

    setGame(chess);
    setPlayerIsWhite(isWhite);
    setMoves([]);
    setAllSans([]);
    setCurrentPly(0);
    setLastMove(undefined);
    setGameOver(null);
    setFeedback(null);
    setHintStep(0);
    setGameId(null);
    setAllUciMoves([]);
    setGameStartTime(new Date().toISOString());
    setOfflineGameId(generateOfflineGameId());

    // Create server record if online
    if (isOnline) {
      try {
        const body: Record<string, unknown> = {
          botElo,
          color: isWhite ? "white" : "black",
        };
        if (showCustom) {
          body.initialTime = customMinutes * 60;
          body.increment = customIncrement;
        } else {
          body.preset = selectedPreset;
        }
        const { data } = await api.post("/api/games/bot", body);
        setGameId(data.game.id);
      } catch {
        // Failed to create server game — play without persistence
      }
    }

    setPhase("game");

    // Bot plays first if player is black
    if (!isWhite) {
      makeBotMove(chess, []);
    }
  }

  async function makeBotMove(chess: Chess, currentMoves: MoveRecord[]) {
    setThinking(true);
    try {
      const moveUci = await stockfish.getBotMove(chess.fen(), botElo);
      if (!moveUci) {
        setThinking(false);
        return;
      }
      const from = moveUci.slice(0, 2);
      const to = moveUci.slice(2, 4);
      const promotion = moveUci[4] || undefined;
      const move = chess.move({ from, to, promotion });
      if (!move) {
        setThinking(false);
        return;
      }

      const ply = currentMoves.length + 1;
      const newMoves = [...currentMoves, { ply, san: move.san, fen: chess.fen() }];
      const newSans = [...currentMoves.map((m) => m.san), move.san];
      setGame(new Chess(chess.fen()));
      setMoves(newMoves);
      setAllSans(newSans);
      setAllUciMoves((prev) => [...prev, moveUci]);
      setCurrentPly(ply);
      setLastMove([from, to]);

      // Update eval
      if (showEvalBar) {
        const ev = await stockfish.evaluate(chess.fen());
        setEvalScore(ev.score);
      }

      // Persist bot move to server if online
      if (gameId && isOnline) {
        // Server already knows about the move if we used the move endpoint
        // But since we're doing client-side bot, we just record it
      }

      if (chess.isGameOver()) {
        const result = chess.isCheckmate()
          ? chess.turn() === "w"
            ? "Black wins by checkmate"
            : "White wins by checkmate"
          : "Draw";
        setGameOver(result);
        setPhase("ended");
        if (!gameId) {
          saveGameOffline(newMoves, [...allUciMoves, moveUci], result, null);
        }
      }
    } finally {
      setThinking(false);
    }
  }

  const handleMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (thinking || gameOver || !stockfish.ready) return;

      const fenBefore = game.fen();
      const chess = new Chess(game.fen());
      const move = chess.move({ from, to, promotion: promotion || undefined });
      if (!move) return;

      const ply = moves.length + 1;
      const newMoves = [...moves, { ply, san: move.san, fen: chess.fen() }];
      const newSans = [...allSans, move.san];
      const playerUciMove = `${from}${to}${promotion || ""}`;
      setGame(new Chess(chess.fen()));
      setMoves(newMoves);
      setAllSans(newSans);
      setAllUciMoves((prev) => [...prev, playerUciMove]);
      setCurrentPly(ply);
      setLastMove([from, to]);
      setHintStep(0);
      setHintSource(null);
      setHintDest(null);

      // Move feedback
      if (showMoveFeedback) {
        const cls = classifyMoveFast(fenBefore, chess.fen(), newSans);
        setFeedback(cls);
      } else {
        setFeedback(null);
      }

      // Update eval
      if (showEvalBar) {
        const ev = await stockfish.evaluate(chess.fen());
        setEvalScore(ev.score);
      }

      // Persist to server if online
      if (gameId && isOnline) {
        try {
          await api.post(`/api/games/${gameId}/move`, { from, to, promotion });
        } catch {
          // Server save failed — game continues locally
        }
      }

      const playerUci = `${from}${to}${promotion || ""}`;

      if (chess.isGameOver()) {
        const result = chess.isCheckmate()
          ? chess.turn() === "w"
            ? "Black wins by checkmate"
            : "White wins by checkmate"
          : "Draw";
        setGameOver(result);
        setPhase("ended");
        if (!gameId) {
          saveGameOffline(newMoves, [...allUciMoves, playerUci], result, null);
        }
        return;
      }

      // Bot responds
      makeBotMove(chess, newMoves);
    },
    [
      game,
      moves,
      allSans,
      thinking,
      gameOver,
      stockfish,
      showMoveFeedback,
      showEvalBar,
      gameId,
      isOnline,
      botElo,
    ]
  );

  function handleHint() {
    if (!stockfish.ready) return;
    // Use eval's bestMove
    stockfish.evaluate(game.fen()).then((ev) => {
      if (!ev.bestMove) return;
      if (hintStep === 0) {
        setHintSource(ev.bestMove.slice(0, 2));
        setHintDest(null);
        setHintStep(1);
      } else if (hintStep === 1) {
        setHintDest(ev.bestMove.slice(2, 4));
        setHintStep(2);
      } else {
        setHintStep(0);
        setHintSource(null);
        setHintDest(null);
      }
    });
  }

  function saveGameOffline(
    gameMoves: MoveRecord[],
    uciMoves: string[],
    result: string | null,
    termination: string | null
  ) {
    if (!offlineGameId || !gameStartTime) return;
    // Map result text to enum
    let dbResult: string | null = null;
    if (result?.includes("White wins")) dbResult = "WHITE_WIN";
    else if (result?.includes("Black wins")) dbResult = "BLACK_WIN";
    else if (result === "Draw") dbResult = "DRAW";

    let dbTerm: string | null = null;
    if (result?.includes("checkmate")) dbTerm = "CHECKMATE";
    else if (result?.includes("resignation")) dbTerm = "RESIGNATION";
    else if (result === "Draw") dbTerm = "AGREEMENT";

    saveOfflineGame({
      id: offlineGameId,
      botElo,
      playerIsWhite,
      moves: gameMoves.map((m, i) => ({
        ply: m.ply,
        san: m.san,
        uci: uciMoves[i] || "",
        fen: m.fen,
      })),
      result: dbResult,
      termination: dbTerm,
      startedAt: gameStartTime,
      endedAt: new Date().toISOString(),
    });
    setPendingSyncCount(getPendingCount());
  }

  async function resign() {
    const result = playerIsWhite ? "Black wins by resignation" : "White wins by resignation";
    setGameOver(result);
    setPhase("ended");
    setConfirmResign(false);
    if (gameId && isOnline) {
      try {
        await api.post(`/api/games/${gameId}/resign`);
      } catch {
        // ignore
      }
    }
    if (!gameId) {
      saveGameOffline(moves, allUciMoves, result, "RESIGNATION");
    }
  }

  function playAgain() {
    setPhase("select");
    setGame(new Chess());
    setGameId(null);
    setMoves([]);
    setAllSans([]);
    setCurrentPly(0);
    setLastMove(undefined);
    setGameOver(null);
    setFeedback(null);
    setError("");
    setHintStep(0);
    setEvalScore(0);
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
    ((game.turn() === "w" && playerIsWhite) || (game.turn() === "b" && !playerIsWhite));
  const isViewingLatest = currentPly === moves.length;
  const displayFen =
    currentPly === 0
      ? moves.length > 0
        ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        : game.fen()
      : moves.find((m) => m.ply === currentPly)?.fen || game.fen();

  const arrows: { from: string; to: string; color: string }[] = [];
  if (hintStep === 2 && hintSource && hintDest)
    arrows.push({ from: hintSource, to: hintDest, color: "green" });
  const highlightedSquares: { square: string; color: string }[] = [];
  if (hintStep >= 1 && hintSource) highlightedSquares.push({ square: hintSource, color: "green" });

  // ── Selection Screen ─────────────────────────────────
  if (phase === "select") {
    return (
      <main className="flex flex-col items-center min-h-screen p-4 pt-12">
        <div className="max-w-lg w-full space-y-6">
          <h1 className="text-2xl font-bold text-center">Play vs Bot</h1>
          {!isOnline && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-2 text-center text-xs text-yellow-300">
              Offline mode — games will sync when you reconnect
            </div>
          )}
          {pendingSyncCount > 0 && isOnline && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-2 text-center text-xs text-green-300">
              Syncing {pendingSyncCount} offline game{pendingSyncCount > 1 ? "s" : ""}...
            </div>
          )}
          {!stockfish.ready && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-300">Loading Stockfish engine...</p>
              <p className="text-xs text-blue-400 mt-1">First load downloads ~7MB (cached after)</p>
            </div>
          )}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {showActivePrompt && activeGame && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-300 mb-3">
                You have an active game vs Bot ({activeGame.botElo})
              </p>
              <div className="flex gap-3">
                <button
                  onClick={resumeGame}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
                >
                  Continue Game
                </button>
                <button
                  onClick={resignActiveAndContinue}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
                >
                  Resign &amp; New Game
                </button>
              </div>
            </div>
          )}

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
                  className={`py-2 rounded text-sm font-medium transition-colors ${colorChoice === c ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
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
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${!showCustom && selectedPreset === p.key ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
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
            disabled={!stockfish.ready}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait rounded-lg text-lg font-bold transition-colors"
          >
            {stockfish.ready ? "Start Game" : "Loading Engine..."}
          </button>

          <div className="text-center">
            <Link href="/play" className="text-gray-400 hover:text-white text-sm">
              &larr; Back to Play
            </Link>
          </div>

          <ConfirmModal
            open={confirmStart}
            title="Start Game?"
            message={`Bot: ${botElo} Elo (${eloLabel(botElo)})\nColor: ${colorChoice}\nTime: ${showCustom ? `${customMinutes}+${customIncrement}` : PRESETS.find((p) => p.key === selectedPreset)?.label || selectedPreset}${!isOnline ? "\n\nOffline — game won't be saved" : ""}`}
            confirmLabel="Start"
            confirmVariant="primary"
            onConfirm={startGame}
            onCancel={() => setConfirmStart(false)}
          />
        </div>
      </main>
    );
  }

  // ── Game / Ended Screen ──────────────────────────────
  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-4">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex gap-2 flex-1 min-w-0">
            {showEvalBar && (
              <div className="h-auto flex">
                <EvaluationBar evalCP={evalScore} mate={null} />
              </div>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                  B
                </div>
                <span className="text-sm font-medium">
                  Bot ({botElo}) <span className="text-gray-500">{eloLabel(botElo)}</span>
                </span>
                {!isOnline && (
                  <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded">
                    OFFLINE
                  </span>
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
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium">{user.username}</span>
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
                  disabled={!isMyTurn || !stockfish.ready}
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
            <p className="text-gray-300 mb-4">{gameOver}</p>
            <div className="flex gap-3">
              <button
                onClick={playAgain}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
              >
                Play Again
              </button>
              {gameId && isOnline && (
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
