"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import api from "../../../../lib/api";
import { useAuthStore } from "../../../../stores/auth";
import { useBotEngine } from "../../../../lib/useBotEngine";
import { useOnlineStatus } from "../../../../lib/useOnlineStatus";
import { lookupOpeningClient } from "../../../../lib/openings";
import {
  type GameModeSettings,
  type GameModePreset,
  GAME_MODE_PRESETS,
  GAME_MODE_LABELS,
  DEFAULT_CUSTOM,
} from "../../../../lib/gameModes";
import {
  saveOfflineGame,
  generateOfflineGameId,
  getPendingCount,
} from "../../../../lib/offlineSync";
import { useSound } from "../../../../lib/useSound";
import { useKeyboardShortcuts } from "../../../../lib/useKeyboardShortcuts";
import dynamic from "next/dynamic";
import KeyboardShortcutsHelp from "../../../../components/KeyboardShortcutsHelp";
import ExportPGN from "../../../../components/ExportPGN";
import { BoardSkeleton } from "../../../../components/Skeleton";

const ChessBoard = dynamic(() => import("../../../../components/ChessBoard"), {
  loading: () => <BoardSkeleton />,
  ssr: false,
});
const EvaluationBar = dynamic(() => import("../../../../components/EvaluationBar"), {
  ssr: false,
});
import MoveList from "../../../../components/MoveList";
import CapturedPieces from "../../../../components/CapturedPieces";
import MoveFeedbackPopup from "../../../../components/MoveFeedbackPopup";
import ConfirmModal from "../../../../components/ConfirmModal";
import type { BotPersonality, MoveRecord, ThinkTimeContext } from "@eyeonchess/chess";
import { computeThinkTime } from "@eyeonchess/chess";
import { useBotChat } from "../../../../lib/useBotChat";
import BotChatBubble from "../../../../components/BotChatBubble";
import { useBotReactions } from "../../../../lib/useBotReactions";
import ReactionOverlay from "../../../../components/ReactionOverlay";

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

/** Build a fallback BotPersonality from the raw Elo slider value (custom elo mode). */
function buildFallbackPersonality(elo: number): BotPersonality {
  const tier = elo >= 2000 ? "engine" : elo >= 1300 ? "hybrid" : "custom";
  const category =
    elo <= 400
      ? "beginner"
      : elo <= 800
        ? "novice"
        : elo <= 1200
          ? "intermediate"
          : elo <= 1600
            ? "advanced"
            : elo <= 2000
              ? "expert"
              : elo <= 2500
                ? "master"
                : "grandmaster";
  return {
    id: "custom",
    name: `Custom (${elo})`,
    elo,
    description: "Custom Elo bot",
    avatar: "\u{1F916}",
    tier,
    category,
    randomMoveChance: elo < 600 ? 0.3 : elo < 1200 ? 0.1 : 0.02,
    blunderChance: elo < 600 ? 0.25 : elo < 1200 ? 0.12 : 0.05,
    captureGreed: 0.4,
    aggressionBias: 0,
    maxDepth: Math.min(18, Math.max(1, Math.floor(elo / 200))),
    queenEarly: false,
    pawnPusher: false,
  };
}

export default function BotGamePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const botEngine = useBotEngine();
  const sound = useSound();
  const isOnline = useOnlineStatus();

  // --- Initialization state ---
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");

  // --- Bot personality ---
  const [bot, setBot] = useState<BotPersonality | null>(null);
  const [botElo, setBotElo] = useState(800);

  // --- Game-phase state ---
  const [game, setGame] = useState(() => new Chess());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [allSans, setAllSans] = useState<string[]>([]);
  const [allUciMoves, setAllUciMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [playerIsWhite, setPlayerIsWhite] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evalScore, setEvalScore] = useState(0);
  const [activeSettings, setActiveSettings] = useState<GameModeSettings>({ ...DEFAULT_CUSTOM });
  const [confirmResign, setConfirmResign] = useState(false);
  const [flipDisplay, setFlipDisplay] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [offlineGameId, setOfflineGameId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  // Hint
  const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
  const [hintSource, setHintSource] = useState<string | null>(null);
  const [hintDest, setHintDest] = useState<string | null>(null);

  // Threats
  const [threatArrows, setThreatArrows] = useState<{ from: string; to: string }[]>([]);

  // Suggestions (auto-shown best move arrow)
  const [suggestionArrow, setSuggestionArrow] = useState<{ from: string; to: string } | null>(null);

  // Engine line (principal variation text)
  const [engineLine, setEngineLine] = useState<string | null>(null);

  // Mode preset label (for display)
  const [modePreset, setModePreset] = useState<GameModePreset>("friendly");

  // --- Sync completed game to server ---
  async function syncGameToServer(
    gameMoves: MoveRecord[],
    uciMoves: string[],
    finalFen: string,
    result: string | null,
    termination: string | null
  ) {
    if (!gameId || !isOnline) return;
    try {
      await api.post(`/api/v1/games/${gameId}/sync-moves`, {
        moves: gameMoves.map((m, i) => ({
          ply: m.ply,
          san: m.san,
          uci: uciMoves[i] || "",
          fen: m.fen,
        })),
        fen: finalFen,
        result,
        termination,
      });
    } catch {
      // Silent fail — game still playable, just won't have server moves for analysis
    }
  }

  // --- Hooks ---
  const botChat = useBotChat({ messages: bot?.messages });
  const botReactions = useBotReactions();

  useKeyboardShortcuts({
    ArrowLeft: () => setCurrentPly((p) => Math.max(0, p - 1)),
    ArrowRight: () => setCurrentPly((p) => Math.min(moves.length, p + 1)),
    Home: () => setCurrentPly(0),
    End: () => setCurrentPly(moves.length),
    f: () => setFlipDisplay((f) => !f),
    F: () => setFlipDisplay((f) => !f),
    h: () => activeSettings.hints && handleHint(),
    H: () => activeSettings.hints && handleHint(),
    r: () => !gameOver && setConfirmResign(true),
    R: () => !gameOver && setConfirmResign(true),
    Escape: () => {
      setConfirmResign(false);
      setShowShortcuts(false);
    },
    "?": () => setShowShortcuts((s) => !s),
  });

  // --- Auth guard ---
  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // --- Load bot personality from localStorage cache ---
  function loadBotFromCache(botId?: string | null, elo?: number): BotPersonality | null {
    try {
      const cached = localStorage.getItem("eyeonchess-bots");
      if (!cached) return null;
      const bots: BotPersonality[] = JSON.parse(cached);
      if (botId) {
        const found = bots.find((b) => b.id === botId);
        if (found) return found;
      }
      if (elo !== undefined) {
        const found = bots.find((b) => b.elo === elo);
        if (found) return found;
      }
    } catch {}
    return null;
  }

  // --- Read game config from sessionStorage (set by selection page) ---
  function readGameConfig(): {
    elo: number;
    color: string;
    mode: string;
    botId: string | null;
    settings: GameModeSettings;
  } | null {
    try {
      const raw = sessionStorage.getItem("botGameConfig");
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  function clearGameConfig() {
    try {
      sessionStorage.removeItem("botGameConfig");
    } catch {}
  }

  function applyConfig(config: ReturnType<typeof readGameConfig>) {
    if (config?.settings) {
      setActiveSettings(config.settings);
    } else if (config?.mode && config.mode !== "custom" && config.mode in GAME_MODE_PRESETS) {
      setActiveSettings(GAME_MODE_PRESETS[config.mode as GameModePreset]);
    } else {
      setActiveSettings(GAME_MODE_PRESETS.friendly);
    }
    if (config?.mode) setModePreset(config.mode as GameModePreset);
    if (config?.botId || config?.elo) {
      const cachedBot = loadBotFromCache(config.botId, config.elo);
      if (cachedBot) setBot(cachedBot);
    }
  }

  // --- Initialization: determine online vs offline, load game state ---
  useEffect(() => {
    if (initialized || !user) return;

    const config = readGameConfig();
    const isOffline = id.startsWith("offline-");

    if (isOffline) {
      const elo = config?.elo || 800;
      const isWhite = config?.color !== "black";

      setBotElo(elo);
      setPlayerIsWhite(isWhite);
      applyConfig(config);

      const chess = new Chess();
      setGame(chess);
      setMoves([]);
      setAllSans([]);
      setAllUciMoves([]);
      setCurrentPly(0);
      setLastMove(undefined);
      setGameOver(null);
      setFeedback(null);
      setEvalScore(0);
      setOfflineGameId(id);
      setGameStartTime(new Date().toISOString());
      setGameId(null);

      clearGameConfig();
      setInitialized(true);
    } else {
      // Online game: fetch from API
      setGameId(id);
      api
        .get(`/api/v1/games/${id}`)
        .then(({ data }) => {
          const g = data.game;
          const chess = new Chess(g.fen);
          setGame(chess);
          setPlayerIsWhite(g.whiteId === user?.id);
          setBotElo(g.botElo || 800);

          // Apply config from sessionStorage, or fall back to defaults
          if (config) {
            applyConfig(config);
          } else {
            // Page refresh without sessionStorage — load bot from cache by elo
            const cachedBot = loadBotFromCache(null, g.botElo);
            if (cachedBot) setBot(cachedBot);
            setActiveSettings(GAME_MODE_PRESETS.friendly);
          }

          // Restore moves
          if (g.moves?.length > 0) {
            const records = g.moves.map(
              (m: { ply: number; san: string; fen: string }) => ({
                ply: m.ply,
                san: m.san,
                fen: m.fen,
              })
            );
            setMoves(records);
            setAllSans(g.moves.map((m: { san: string }) => m.san));
            setAllUciMoves(
              g.moves
                .filter((m: { uci?: string }) => m.uci)
                .map((m: { uci: string }) => m.uci)
            );
            setCurrentPly(records.length);
            const last = g.moves[g.moves.length - 1];
            if (last.uci?.length >= 4) {
              setLastMove([last.uci.slice(0, 2), last.uci.slice(2, 4)]);
            }
          }

          setOfflineGameId(null);
          setGameStartTime(g.startedAt || new Date().toISOString());
          clearGameConfig();
          setInitialized(true);
        })
        .catch(() => {
          setError("Failed to load game.");
          setInitialized(true);
        });
    }
  }, [initialized, user, id]);

  // --- Handle bot first move (if player is black) ---
  useEffect(() => {
    if (!initialized || !botEngine.ready) return;
    // Only fire once: on a fresh game where it's the bot's turn (player is black, no moves yet)
    if (moves.length === 0 && !playerIsWhite && !gameOver && !thinking) {
      setTimeout(() => botChat.triggerMessage("gameStart"), 500);
      makeBotMove(game, []);
    }
    // If player is white and game is fresh, just trigger game start chat
    if (moves.length === 0 && playerIsWhite && !gameOver) {
      setTimeout(() => botChat.triggerMessage("gameStart"), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, botEngine.ready]);

  // --- Save game offline ---
  function saveGameOffline(gameMoves: MoveRecord[], uciMoves: string[], result: string | null) {
    if (!offlineGameId || !gameStartTime) return;
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
  }

  // --- Bot move ---
  async function makeBotMove(chess: Chess, currentMoves: MoveRecord[]) {
    setThinking(true);
    try {
      const personality = bot || buildFallbackPersonality(botElo);
      const currentSans = currentMoves.map((m) => m.san);
      const moveUci = await botEngine.getPersonalityMove(chess.fen(), personality, currentSans);
      if (!moveUci) return;
      const from = moveUci.slice(0, 2);
      const to = moveUci.slice(2, 4);
      const promotion = moveUci[4] || undefined;

      // Simulated think time -- delay before applying move
      const peekChess = new Chess(chess.fen());
      const peekMove = peekChess.move({ from, to, promotion });
      const thinkCtx: ThinkTimeContext = {
        ply: currentMoves.length + 1,
        isInCheck: chess.inCheck(),
        isCapture: !!peekMove?.captured,
        evalCp: playerIsWhite ? -evalScore : evalScore,
        playerBlundered: feedback === "BLUNDER",
      };
      const thinkDelay = computeThinkTime(personality, thinkCtx);
      // Maybe send a thinking reaction during think time
      const confFactor = personality.randomMoveChance + personality.blunderChance;
      if (Math.random() < confFactor * 0.3) {
        setTimeout(() => botReactions.triggerReaction("thinking", personality), thinkDelay * 0.4);
      }
      await new Promise((r) => setTimeout(r, thinkDelay));

      const move = chess.move({ from, to, promotion });
      if (!move) return;
      const ply = currentMoves.length + 1;
      const newMoves = [...currentMoves, { ply, san: move.san, fen: chess.fen() }];
      setGame(new Chess(chess.fen()));
      setMoves(newMoves);
      setAllSans((prev) => [...prev, move.san]);
      setAllUciMoves((prev) => [...prev, moveUci]);
      setCurrentPly(ply);
      setLastMove([from, to]);
      sound.playForMove(move);
      if (move.captured) {
        botChat.triggerMessage("onCapture");
        botReactions.triggerReaction("botCapture", personality);
      } else if (chess.inCheck()) {
        botChat.triggerMessage("onGivingCheck");
        botReactions.triggerReaction("botCheck", personality);
      }
      // Game-over detection BEFORE eval
      if (chess.isGameOver()) {
        const result = chess.isCheckmate()
          ? chess.turn() === "w"
            ? "Black wins by checkmate"
            : "White wins by checkmate"
          : "Draw";
        if (chess.isCheckmate()) botChat.triggerMessage("onCheckmate");
        else botChat.triggerMessage("onDraw");
        botReactions.triggerReaction("gameEnd", personality);
        setGameOver(result);
        sound.playGameOver();
        setThreatArrows([]);
        if (!gameId) saveGameOffline(newMoves, [...allUciMoves, moveUci], result);
        const term = chess.isCheckmate() ? "CHECKMATE" : "AGREEMENT";
        const dbResult = result.includes("White wins") ? "WHITE_WIN" : result.includes("Black wins") ? "BLACK_WIN" : "DRAW";
        syncGameToServer(newMoves, [...allUciMoves, moveUci], chess.fen(), dbResult, term);
      } else {
        // Single eval call for all features (evalBar, threats, suggestions, engine)
        const needsEval =
          activeSettings.evalBar ||
          activeSettings.threats ||
          activeSettings.suggestions ||
          activeSettings.engine;
        if (needsEval) {
          const ev = await botEngine.evaluate(chess.fen());
          if (activeSettings.evalBar) setEvalScore(ev.score);
          const botAdvantage = playerIsWhite ? -ev.score : ev.score;
          if (botAdvantage > 300) botChat.triggerMessage("onWinning");
          else if (botAdvantage < -300) botChat.triggerMessage("onLosing");
          const validBestMove = ev.bestMove && ev.bestMove.length >= 4;
          if (activeSettings.threats && validBestMove) {
            setThreatArrows([{ from: ev.bestMove.slice(0, 2), to: ev.bestMove.slice(2, 4) }]);
          } else {
            setThreatArrows([]);
          }
          if (activeSettings.suggestions && validBestMove) {
            setSuggestionArrow({ from: ev.bestMove.slice(0, 2), to: ev.bestMove.slice(2, 4) });
          } else {
            setSuggestionArrow(null);
          }
          if (activeSettings.engine && validBestMove) {
            const score = ev.score;
            const scoreStr =
              Math.abs(score) > 99000
                ? `M${Math.sign(score) > 0 ? "" : "-"}${Math.ceil(Math.abs(100000 - Math.abs(score)) / 2)}`
                : `${score > 0 ? "+" : ""}${(score / 100).toFixed(1)}`;
            setEngineLine(`${scoreStr} ${ev.bestMove.slice(0, 2)}-${ev.bestMove.slice(2, 4)}`);
          } else {
            setEngineLine(null);
          }
        } else {
          setThreatArrows([]);
          setSuggestionArrow(null);
          setEngineLine(null);
        }
      }
    } finally {
      setThinking(false);
    }
  }

  // --- Player move ---
  const handleMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (thinking || gameOver || !botEngine.ready) return;
      const fenBefore = game.fen();
      const chess = new Chess(game.fen());
      const move = chess.move({ from, to, promotion: promotion || undefined });
      if (!move) return;
      const playerUci = `${from}${to}${promotion || ""}`;
      const ply = moves.length + 1;
      const newMoves = [...moves, { ply, san: move.san, fen: chess.fen() }];
      const newSans = [...allSans, move.san];
      setGame(new Chess(chess.fen()));
      setMoves(newMoves);
      setAllSans(newSans);
      setAllUciMoves((prev) => [...prev, playerUci]);
      setCurrentPly(ply);
      setLastMove([from, to]);
      sound.playForMove(move);
      if (chess.inCheck()) {
        botChat.triggerMessage("onBeingChecked");
        const p = bot || buildFallbackPersonality(botElo);
        botReactions.triggerReaction("botInCheck", p);
      }
      setHintStep(0);
      setHintSource(null);
      setHintDest(null);
      setThreatArrows([]);
      setSuggestionArrow(null);
      setEngineLine(null);
      setFeedback(null);
      // Skip evaluation if game is already over (checkmate/stalemate)
      if (chess.isGameOver()) {
        const result = chess.isCheckmate()
          ? chess.turn() === "w"
            ? "Black wins by checkmate"
            : "White wins by checkmate"
          : "Draw";
        const pEnd = bot || buildFallbackPersonality(botElo);
        if (chess.isCheckmate()) botChat.triggerMessage("onCheckmated");
        else botChat.triggerMessage("onDraw");
        botReactions.triggerReaction("gameEnd", pEnd);
        setGameOver(result);
        sound.playGameOver();
        if (!gameId) saveGameOffline(newMoves, [...allUciMoves, playerUci], result);
        const term = chess.isCheckmate() ? "CHECKMATE" : "AGREEMENT";
        const dbResult = result.includes("White wins") ? "WHITE_WIN" : result.includes("Black wins") ? "BLACK_WIN" : "DRAW";
        syncGameToServer(newMoves, [...allUciMoves, playerUci], chess.fen(), dbResult, term);
        return;
      }
      // Evaluate position before bot responds for move feedback and eval bar
      if (activeSettings.moveFeedback || activeSettings.evalBar) {
        const evBefore = await botEngine.evaluate(fenBefore);
        const evAfter = await botEngine.evaluate(chess.fen());
        if (activeSettings.evalBar) setEvalScore(evAfter.score);
        if (activeSettings.moveFeedback) {
          const opening = lookupOpeningClient(newSans);
          if (opening) {
            setFeedback("BOOK");
          } else {
            const isWhiteMove = fenBefore.split(" ")[1] === "w";
            const cpLoss = isWhiteMove
              ? evBefore.score - evAfter.score
              : evAfter.score - evBefore.score;
            const pForReaction = bot || buildFallbackPersonality(botElo);
            if (cpLoss <= 0) {
              setFeedback("BEST");
              botReactions.triggerReaction("playerGoodMove", pForReaction);
            } else if (cpLoss <= 10) {
              setFeedback("EXCELLENT");
              botReactions.triggerReaction("playerGoodMove", pForReaction);
            } else if (cpLoss <= 25) setFeedback("GOOD");
            else if (cpLoss <= 50) setFeedback("GOOD");
            else if (cpLoss <= 100) setFeedback("INACCURACY");
            else if (cpLoss <= 200) setFeedback("MISTAKE");
            else {
              setFeedback("BLUNDER");
              botChat.triggerMessage("onPlayerBlunder");
              botReactions.triggerReaction("playerBlunder", pForReaction);
            }
          }
        }
      }
      // Bot games use client-side engine -- don't sync individual moves to server
      // Game will be synced as a whole via /games/sync at completion.

      // Game-over already handled above (before eval). Proceed to bot move.
      makeBotMove(chess, newMoves);
    },
    [
      game,
      moves,
      allSans,
      allUciMoves,
      thinking,
      gameOver,
      botEngine,
      activeSettings,
      gameId,
      isOnline,
      botElo,
      bot,
      botChat,
      botReactions,
    ]
  );

  // --- Hint ---
  function handleHint() {
    if (!botEngine.ready || !activeSettings.hints) return;
    botEngine.evaluate(game.fen()).then((ev) => {
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

  // --- Takeback ---
  function handleTakeback() {
    if (!activeSettings.takeback || moves.length < 2) return;
    const newMoves = moves.slice(0, -2);
    const newFen =
      newMoves.length > 0
        ? newMoves[newMoves.length - 1].fen
        : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    setGame(new Chess(newFen));
    setMoves(newMoves);
    setAllSans(newMoves.map((m) => m.san));
    setAllUciMoves((prev) => prev.slice(0, -2));
    setCurrentPly(newMoves.length);
    setLastMove(undefined);
    setFeedback(null);
  }

  // --- Resign ---
  async function resign() {
    const result = playerIsWhite ? "Black wins by resignation" : "White wins by resignation";
    setGameOver(result);
    setConfirmResign(false);
    if (gameId && isOnline) {
      try {
        await api.post(`/api/v1/games/${gameId}/resign`);
      } catch {}
    }
    if (!gameId) saveGameOffline(moves, allUciMoves, result);
    const dbResult = playerIsWhite ? "BLACK_WIN" : "WHITE_WIN";
    syncGameToServer(moves, allUciMoves, game.fen(), dbResult, "RESIGNATION");
  }

  // --- Play Again (go back to selection) ---
  function playAgain() {
    botChat.clearMessage();
    botReactions.clearReactions();
    router.push("/play/bot");
  }

  // --- Rematch ---
  async function rematch() {
    const isWhite = !playerIsWhite;
    botChat.clearMessage();
    botReactions.clearReactions();

    if (isOnline && !id.startsWith("offline-")) {
      // Online: create new game on server
      try {
        const { data } = await api.post("/api/v1/games/bot", {
          botElo,
          color: isWhite ? "white" : "black",
        });
        const newId = data.game.id;
        const params = new URLSearchParams();
        if (bot) params.set("botId", bot.id);
        const paramStr = params.toString();
        router.push(`/play/bot/${newId}${paramStr ? `?${paramStr}` : ""}`);
      } catch {
        setError("Failed to create rematch.");
      }
    } else {
      // Offline: generate new offline ID
      const newId = generateOfflineGameId();
      const params = new URLSearchParams();
      params.set("elo", String(botElo));
      params.set("color", isWhite ? "white" : "black");
      params.set("preset", modePreset);
      if (bot) params.set("botId", bot.id);
      router.push(`/play/bot/${newId}?${params.toString()}`);
    }
  }

  // --- Derived state ---
  const baseOrientation = playerIsWhite ? "white" : "black";
  const orientation = flipDisplay
    ? baseOrientation === "white"
      ? "black"
      : "white"
    : baseOrientation;
  const isMyTurn =
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
  const isInCheck = useMemo(() => {
    try {
      return new Chess(displayFen).inCheck();
    } catch {
      return false;
    }
  }, [displayFen]);

  // --- Loading / auth guard ---
  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (!initialized) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading game...</p>
      </main>
    );
  }

  if (error && !initialized) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  // --- Arrows & highlights ---
  const arrows: { from: string; to: string; color: string }[] = [];
  if (hintStep === 2 && hintSource && hintDest)
    arrows.push({ from: hintSource, to: hintDest, color: "green" });
  for (const t of threatArrows) arrows.push({ from: t.from, to: t.to, color: "red" });
  if (suggestionArrow)
    arrows.push({ from: suggestionArrow.from, to: suggestionArrow.to, color: "blue" });
  const highlightedSquares: { square: string; color: string }[] = [];
  if (hintStep >= 1 && hintSource) highlightedSquares.push({ square: hintSource, color: "green" });

  // ── GAME SCREEN ──────────────────────────────────────
  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-4">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex gap-2 flex-1 min-w-0">
            {activeSettings.evalBar && (
              <div className="h-auto flex">
                <EvaluationBar evalCP={evalScore} mate={null} />
              </div>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-base">
                  {bot ? bot.avatar : "\u{1F916}"}
                </div>
                <span className="text-sm font-medium">
                  {bot ? bot.name : "Bot"} ({botElo}){" "}
                  <span className="text-gray-500">{eloLabel(botElo)}</span>
                </span>
                <BotChatBubble message={botChat.currentMessage} />
                {!isOnline && (
                  <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded">
                    OFFLINE
                  </span>
                )}
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
                  {GAME_MODE_LABELS[modePreset].name}
                </span>
              </div>
              <CapturedPieces fen={displayFen} color={playerIsWhite ? "white" : "black"} />

              <div className="relative w-full max-w-[640px] border-2 border-gray-700 rounded">
                <ChessBoard
                  fen={displayFen}
                  orientation={orientation}
                  movable={isMyTurn && isViewingLatest && !gameOver}
                  lastMove={lastMove}
                  check={isInCheck}
                  onMove={handleMove}
                  arrows={arrows.length > 0 ? arrows : undefined}
                  highlightedSquares={
                    highlightedSquares.length > 0 ? highlightedSquares : undefined
                  }
                />
                {activeSettings.moveFeedback && <MoveFeedbackPopup classification={feedback} />}
                <ReactionOverlay reactions={botReactions.activeReactions} onExpired={botReactions.removeReaction} />
                {activeSettings.engine && engineLine && (
                  <div className="absolute top-2 left-2 bg-gray-900/80 px-2 py-1 rounded text-xs text-blue-400 font-mono">
                    {engineLine}
                  </div>
                )}
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

            {!gameOver && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {activeSettings.hints && (
                    <button
                      onClick={handleHint}
                      disabled={!isMyTurn || !botEngine.ready}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                    >
                      {hintStep === 0 ? "Hint" : hintStep === 1 ? "Show Move" : "Hide"}
                    </button>
                  )}
                  {activeSettings.takeback && moves.length >= 2 && (
                    <button
                      onClick={handleTakeback}
                      disabled={thinking}
                      className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                    >
                      Takeback
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setConfirmResign(true)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
                >
                  Resign
                </button>
              </div>
            )}
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button
              onClick={() => setShowShortcuts(true)}
              className="w-full py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Keyboard shortcuts (?)
            </button>
          </div>
        </div>
      </div>

      <KeyboardShortcutsHelp
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={[
          { key: "\u2190/\u2192", description: "Previous/next move" },
          { key: "Home/End", description: "First/last move" },
          { key: "F", description: "Flip board" },
          ...(activeSettings.hints ? [{ key: "H", description: "Hint" }] : []),
          { key: "R", description: "Resign" },
          { key: "Esc", description: "Close modal" },
          { key: "?", description: "This help" },
        ]}
      />

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
            <p className="text-gray-300 mb-1">{gameOver}</p>
            <p className="text-gray-500 text-sm mb-4">
              vs {bot ? `${bot.avatar} ${bot.name}` : "Bot"} ({botElo})
            </p>
            <div className="flex gap-3">
              <button
                onClick={rematch}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
              >
                Rematch
              </button>
              <button
                onClick={playAgain}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
              >
                New Game
              </button>
              {gameId && isOnline && (
                <>
                  <button
                    onClick={() => router.push(`/game/${gameId}/analysis`)}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                  >
                    Analyze
                  </button>
                  <ExportPGN gameId={gameId} compact />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
