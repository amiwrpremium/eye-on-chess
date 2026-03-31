"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import api from "../../../../lib/api";
import { useAuthStore } from "../../../../stores/auth";
import { useSettingsStore } from "../../../../stores/settings";
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
  savePendingSync,
  saveInProgress,
  loadInProgress,
  clearInProgress,
} from "../../../../lib/offlineSync";
import { useSound } from "../../../../lib/useSound";
import { useKeyboardShortcuts } from "../../../../lib/useKeyboardShortcuts";
import dynamic from "next/dynamic";
import KeyboardShortcutsHelp from "../../../../components/KeyboardShortcutsHelp";
import ExportPGN from "../../../../components/ExportPGN";
import { BoardSkeleton } from "@eyeonchess/ui";

const ChessBoard = dynamic(() => import("../../../../components/ChessBoard"), {
  loading: () => <BoardSkeleton />,
  ssr: false,
});
const EvaluationBar = dynamic(() => import("../../../../components/EvaluationBar"), {
  ssr: false,
});
import MoveList from "../../../../components/MoveList";
import MoveTimeline from "../../../../components/MoveTimeline";
import CapturedPieces from "../../../../components/CapturedPieces";
import MoveFeedbackPopup from "../../../../components/MoveFeedbackPopup";
import { ConfirmModal } from "@eyeonchess/ui";
import type { BotPersonality, MoveRecord, ThinkTimeContext } from "@eyeonchess/chess";
import { computeThinkTime } from "@eyeonchess/chess";
import { useBotChat } from "../../../../lib/useBotChat";
import BotChatBubble from "../../../../components/BotChatBubble";
import { useBotReactions } from "../../../../lib/useBotReactions";
import ReactionOverlay from "../../../../components/ReactionOverlay";
import Confetti from "../../../../components/Confetti";
import EngineLines from "../../../../components/EngineLines";
import type { EngineLine } from "../../../../lib/useStockfish";

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

export default function BotGamePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const { darkMode, setDarkMode } = useSettingsStore();
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
  const [gameOverQuote, setGameOverQuote] = useState<string | null>(null);
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

  // Engine lines (multi-PV principal variations)
  const [engineLines, setEngineLines] = useState<EngineLine[]>([]);

  // Move hover preview
  const [previewArrow, setPreviewArrow] = useState<{ from: string; to: string } | null>(null);

  // Copy FEN feedback
  const [fenCopied, setFenCopied] = useState(false);

  // Board coordinates toggle
  const [showCoordinates, setShowCoordinates] = useState(true);

  // Confetti on player win
  const [showConfetti, setShowConfetti] = useState(false);

  // Mode preset label (for display)
  const [modePreset, setModePreset] = useState<GameModePreset>("friendly");

  function pickGameOverQuote(result: string) {
    const msgs = bot?.messages;
    if (!msgs) return;
    const playerWon = result.includes("White wins")
      ? playerIsWhite
      : result.includes("Black wins")
        ? !playerIsWhite
        : false;
    const playerLost = result.includes("White wins")
      ? !playerIsWhite
      : result.includes("Black wins")
        ? playerIsWhite
        : false;
    // Bot's perspective: if player won, bot was checkmated; if player lost, bot won
    const pool = playerWon ? msgs.onCheckmated : playerLost ? msgs.onCheckmate : msgs.onDraw;
    if (pool && pool.length > 0) {
      setGameOverQuote(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // --- Sync completed game to server ---
  async function syncGameToServer(
    gameMoves: MoveRecord[],
    uciMoves: string[],
    _finalFen: string,
    result: string | null,
    termination: string | null
  ) {
    if (!gameId || !isOnline) return;
    const syncMoves = gameMoves.map((m, i) => ({
      ply: m.ply,
      san: m.san,
      uci: uciMoves[i] || "",
      fen: m.fen,
    }));
    try {
      await api.post(`/api/v1/games/${gameId}/sync-moves`, {
        moves: syncMoves,
        fen: "",
        result,
        termination,
      });
    } catch {
      // Save to pending queue for retry on next page load
      savePendingSync({ gameId, moves: syncMoves, result, termination });
      try {
        const { useToast } = await import("@eyeonchess/ui");
        useToast.getState().show("Game sync failed — will retry later", "error");
      } catch {}
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
    z: () => activeSettings.takeback && handleTakeback(),
    Z: () => activeSettings.takeback && handleTakeback(),
    r: () => !gameOver && setConfirmResign(true),
    R: () => !gameOver && setConfirmResign(true),
    Escape: () => {
      setConfirmResign(false);
      setShowShortcuts(false);
    },
    "?": () => setShowShortcuts((s) => !s),
  });

  // --- Auto-save game state to localStorage every move ---
  useEffect(() => {
    if (moves.length === 0 || gameOver || !initialized) return;
    saveInProgress(id, {
      id,
      botElo,
      playerIsWhite,
      moves: moves.map((m, i) => ({
        ply: m.ply,
        san: m.san,
        uci: allUciMoves[i] || "",
        fen: m.fen,
      })),
      gameStartTime: gameStartTime || new Date().toISOString(),
      activeSettings: activeSettings as unknown as Record<string, boolean>,
      botId: bot?.id || null,
      isOnline: !!gameId,
      savedAt: new Date().toISOString(),
    });
  }, [moves, gameOver, initialized]);

  // --- Save on tab close ---
  useEffect(() => {
    const handler = () => {
      if (moves.length > 0 && !gameOver && initialized) {
        saveInProgress(id, {
          id,
          botElo,
          playerIsWhite,
          moves: moves.map((m, i) => ({
            ply: m.ply,
            san: m.san,
            uci: allUciMoves[i] || "",
            fen: m.fen,
          })),
          gameStartTime: gameStartTime || new Date().toISOString(),
          activeSettings: activeSettings as unknown as Record<string, boolean>,
          botId: bot?.id || null,
          isOnline: !!gameId,
          savedAt: new Date().toISOString(),
        });
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [
    moves,
    gameOver,
    initialized,
    id,
    botElo,
    playerIsWhite,
    allUciMoves,
    gameStartTime,
    activeSettings,
    bot,
    gameId,
  ]);

  // --- Stockfish load timeout ---
  useEffect(() => {
    if (botEngine.ready) return;
    const timeout = setTimeout(() => {
      if (!botEngine.ready) {
        setError("Chess engine failed to load. Please check your connection and try again.");
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [botEngine.ready]);

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
      setActiveSettings(GAME_MODE_PRESETS[config.mode as Exclude<GameModePreset, "custom">]);
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

    // Check for saved in-progress game (browser crash / refresh recovery)
    const saved = loadInProgress(id);
    if (saved && saved.moves.length > 0) {
      const lastFen = saved.moves[saved.moves.length - 1].fen;
      const chess = new Chess(lastFen);
      setGame(chess);
      setMoves(saved.moves.map((m) => ({ ply: m.ply, san: m.san, fen: m.fen })));
      setAllSans(saved.moves.map((m) => m.san));
      setAllUciMoves(saved.moves.map((m) => m.uci));
      setCurrentPly(saved.moves.length);
      const last = saved.moves[saved.moves.length - 1];
      if (last.uci?.length >= 4) {
        setLastMove([last.uci.slice(0, 2), last.uci.slice(2, 4)]);
      }
      setBotElo(saved.botElo);
      setPlayerIsWhite(saved.playerIsWhite);
      setGameStartTime(saved.gameStartTime);
      if (saved.activeSettings) {
        setActiveSettings(saved.activeSettings as unknown as GameModeSettings);
      }
      if (saved.isOnline) {
        setGameId(id);
        setOfflineGameId(null);
      } else {
        setGameId(null);
        setOfflineGameId(id);
      }
      // Load bot from cache
      const cachedBot = loadBotFromCache(saved.botId, saved.botElo);
      if (cachedBot) setBot(cachedBot);
      clearGameConfig();
      setInitialized(true);
      return;
    }

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
      sound.playNotify();
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
            const records = g.moves.map((m: { ply: number; san: string; fen: string }) => ({
              ply: m.ply,
              san: m.san,
              fen: m.fen,
            }));
            setMoves(records);
            setAllSans(g.moves.map((m: { san: string }) => m.san));
            setAllUciMoves(
              g.moves.filter((m: { uci?: string }) => m.uci).map((m: { uci: string }) => m.uci)
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
          sound.playNotify();
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
        const playerWon =
          (playerIsWhite && result.includes("White wins")) ||
          (!playerIsWhite && result.includes("Black wins"));
        if (playerWon) setShowConfetti(true);
        pickGameOverQuote(result);
        clearInProgress(id);
        sound.playGameOver();
        setThreatArrows([]);
        if (!gameId) saveGameOffline(newMoves, [...allUciMoves, moveUci], result);
        const term = chess.isCheckmate() ? "CHECKMATE" : "AGREEMENT";
        const dbResult = result.includes("White wins")
          ? "WHITE_WIN"
          : result.includes("Black wins")
            ? "BLACK_WIN"
            : "DRAW";
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
          const bm = ev.bestMove;
          const validBestMove = bm != null && bm.length >= 4;
          if (activeSettings.threats && validBestMove) {
            setThreatArrows([{ from: bm.slice(0, 2), to: bm.slice(2, 4) }]);
          } else {
            setThreatArrows([]);
          }
          if (activeSettings.suggestions && validBestMove) {
            setSuggestionArrow({ from: bm.slice(0, 2), to: bm.slice(2, 4) });
          } else {
            setSuggestionArrow(null);
          }
          if (activeSettings.engine) {
            const pvLines = await botEngine.evaluateMultiPV(chess.fen(), 3);
            setEngineLines(pvLines);
          } else {
            setEngineLines([]);
          }
        } else {
          setThreatArrows([]);
          setSuggestionArrow(null);
          setEngineLines([]);
        }
      }
    } catch (err) {
      setError(
        `Bot move failed: ${err instanceof Error ? err.message : "Unknown error"}. Try refreshing.`
      );
    } finally {
      setThinking(false);
    }
  }

  // --- Player move ---
  const handleMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (gameOver || !botEngine.ready) return;
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
      setEngineLines([]);
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
        const playerWon2 =
          (playerIsWhite && result.includes("White wins")) ||
          (!playerIsWhite && result.includes("Black wins"));
        if (playerWon2) setShowConfetti(true);
        clearInProgress(id);
        sound.playGameOver();
        if (!gameId) saveGameOffline(newMoves, [...allUciMoves, playerUci], result);
        const term = chess.isCheckmate() ? "CHECKMATE" : "AGREEMENT";
        const dbResult = result.includes("White wins")
          ? "WHITE_WIN"
          : result.includes("Black wins")
            ? "BLACK_WIN"
            : "DRAW";
        syncGameToServer(newMoves, [...allUciMoves, playerUci], chess.fen(), dbResult, term);
        return;
      }
      // Evaluate position before bot responds for move feedback and eval bar
      if (activeSettings.moveFeedback || activeSettings.evalBar) {
        let evBefore, evAfter;
        try {
          evBefore = await botEngine.evaluate(fenBefore);
          evAfter = await botEngine.evaluate(chess.fen());
        } catch {
          // Eval failed — continue without feedback, don't crash the game
          makeBotMove(chess, newMoves);
          return;
        }
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
      // Update engine lines after player move (before bot responds)
      if (activeSettings.engine) {
        botEngine
          .evaluateMultiPV(chess.fen(), 3)
          .then(setEngineLines)
          .catch(() => {});
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
    sound.playUndo();
  }

  // --- Resign ---
  async function resign() {
    const result = playerIsWhite ? "Black wins by resignation" : "White wins by resignation";
    setGameOver(result);
    clearInProgress(id);
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
    clearInProgress(id);
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

  const openingName = useMemo(() => {
    if (allSans.length === 0) return null;
    const opening = lookupOpeningClient(allSans);
    return opening ? `${opening.eco} ${opening.name}` : null;
  }, [allSans]);
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

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">♟️</div>
          <h1 className="text-xl font-bold text-red-400 mb-2">Game Error</h1>
          <p className="text-sm text-gray-400 mb-2">{error}</p>
          <p className="text-xs text-gray-500 mb-4">
            Your game progress has been saved automatically.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              Retry
            </button>
            <button
              onClick={() => (window.location.href = "/play/bot")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
            >
              Exit
            </button>
          </div>
        </div>
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
  if (previewArrow) arrows.push({ from: previewArrow.from, to: previewArrow.to, color: "yellow" });
  const highlightedSquares: { square: string; color: string }[] = [];
  if (hintStep >= 1 && hintSource) highlightedSquares.push({ square: hintSource, color: "green" });

  // ── GAME SCREEN ──────────────────────────────────────
  return (
    <main className="flex flex-col h-[100dvh] lg:h-auto lg:min-h-screen overflow-hidden lg:overflow-auto p-1 lg:p-4">
      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 min-h-0 lg:block">
        <div className="flex flex-col lg:flex-row gap-1 lg:gap-4 items-start flex-1 min-h-0">
          {/* ── LEFT: Board area ── */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full justify-center lg:justify-start">
            {/* Bot info */}
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <div className="w-5 h-5 lg:w-7 lg:h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs lg:text-base shrink-0">
                {bot ? bot.avatar : "\u{1F916}"}
              </div>
              <span className="text-xs lg:text-sm font-medium truncate">
                {bot ? bot.name : "Bot"} ({botElo})
              </span>
              <BotChatBubble message={botChat.currentMessage} />
              {thinking && (
                <span className="flex gap-0.5 ml-1">
                  <span
                    className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
              )}
            </div>

            {/* Eval bar (horizontal on mobile, vertical on desktop) */}
            {activeSettings.evalBar && (
              <div className="lg:hidden h-3 w-full">
                <EvaluationBar evalCP={evalScore} mate={null} />
              </div>
            )}

            {/* Engine lines (flow element, not overlaid) */}
            {activeSettings.engine && (
              <div className="lg:hidden">
                <EngineLines lines={engineLines} fen={displayFen} loading={thinking} />
              </div>
            )}

            {/* Board + desktop eval bar wrapper */}
            <div className="flex gap-1 flex-1 min-h-0">
              {activeSettings.evalBar && (
                <div className="hidden lg:flex h-auto">
                  <EvaluationBar evalCP={evalScore} mate={null} />
                </div>
              )}
              <div className="flex flex-col flex-1 min-h-0 min-w-0">
                {/* Desktop: captured pieces */}
                <div className="hidden lg:block">
                  <CapturedPieces fen={displayFen} color={playerIsWhite ? "white" : "black"} />
                </div>

                {/* BOARD */}
                <div className="relative w-full lg:max-w-[640px] border border-gray-700 rounded">
                  <ChessBoard
                    fen={displayFen}
                    orientation={orientation}
                    movable={isMyTurn && isViewingLatest && !gameOver}
                    premovable={!gameOver && isViewingLatest}
                    coordinates={showCoordinates}
                    lastMove={lastMove}
                    check={isInCheck}
                    onMove={handleMove}
                    arrows={arrows.length > 0 ? arrows : undefined}
                    highlightedSquares={
                      highlightedSquares.length > 0 ? highlightedSquares : undefined
                    }
                  />
                  {activeSettings.moveFeedback && <MoveFeedbackPopup classification={feedback} />}
                  <ReactionOverlay
                    reactions={botReactions.activeReactions}
                    onExpired={botReactions.removeReaction}
                  />
                  {showConfetti && <Confetti />}
                </div>

                {/* Desktop: captured pieces */}
                <div className="hidden lg:block">
                  <CapturedPieces fen={displayFen} color={playerIsWhite ? "black" : "white"} />
                </div>
              </div>
            </div>

            {/* Player info */}
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <div className="w-5 h-5 lg:w-7 lg:h-7 bg-gray-700 rounded-full flex items-center justify-center text-[10px] lg:text-xs font-bold shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-xs lg:text-sm font-medium">{user.username}</span>
            </div>

            {/* Mobile: move timeline */}
            <div className="lg:hidden">
              <MoveTimeline
                moves={moves}
                currentPly={currentPly}
                totalMoves={moves.length}
                onGoToPly={setCurrentPly}
              />
            </div>

            {/* Mobile: action buttons (icons only) */}
            <div className="lg:hidden flex gap-1.5 justify-center px-1 py-0.5">
              <button
                onClick={() => setFlipDisplay((f) => !f)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                title="Flip board"
              >
                {"\uD83D\uDD04"}
              </button>
              {!gameOver && activeSettings.hints && (
                <button
                  onClick={handleHint}
                  disabled={!isMyTurn || !botEngine.ready}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
                  title="Hint"
                >
                  {"\uD83D\uDCA1"}
                </button>
              )}
              {!gameOver && activeSettings.takeback && moves.length >= 2 && (
                <button
                  onClick={handleTakeback}
                  disabled={thinking}
                  className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm"
                  title="Takeback"
                >
                  {"\u21A9\uFE0F"}
                </button>
              )}
              {!gameOver && (
                <button
                  onClick={() => setConfirmResign(true)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  title="Resign"
                >
                  {"\uD83C\uDFF3\uFE0F"}
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT: Desktop panel ── */}
          <div className="hidden lg:block w-72 space-y-3">
            {openingName && (
              <div className="text-xs text-gray-400 text-center px-2 py-1 bg-gray-900 rounded">
                {openingName}
              </div>
            )}
            {activeSettings.engine && (
              <EngineLines lines={engineLines} fen={displayFen} loading={thinking} />
            )}
            <MoveList
              moves={moves}
              currentPly={currentPly}
              onGoToPly={setCurrentPly}
              onMoveHover={(ply) => {
                const uci = allUciMoves[ply - 1];
                if (uci && uci.length >= 4) {
                  setPreviewArrow({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
                }
              }}
              onMoveHoverEnd={() => setPreviewArrow(null)}
            />
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setCurrentPly(0)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &laquo;
              </button>
              <button
                onClick={() => setCurrentPly(Math.max(0, currentPly - 1))}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => setCurrentPly(Math.min(moves.length, currentPly + 1))}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setCurrentPly(moves.length)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &raquo;
              </button>
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(displayFen)
                    .then(() => {
                      setFenCopied(true);
                      setTimeout(() => setFenCopied(false), 1500);
                    })
                    .catch(() => {});
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                title="Copy FEN"
              >
                {fenCopied ? "\u2713 FEN" : "FEN"}
              </button>
              <button
                onClick={() => setShowCoordinates((c) => !c)}
                className={`px-3 py-1.5 rounded text-xs ${showCoordinates ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-800 text-gray-500"}`}
              >
                a-h
              </button>
            </div>
            {!gameOver && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {activeSettings.hints && (
                    <button
                      onClick={handleHint}
                      disabled={!isMyTurn || !botEngine.ready}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium"
                    >
                      {hintStep === 0 ? "Hint" : hintStep === 1 ? "Show Move" : "Hide"}
                    </button>
                  )}
                  {activeSettings.takeback && moves.length >= 2 && (
                    <button
                      onClick={handleTakeback}
                      disabled={thinking}
                      className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm font-medium"
                    >
                      Takeback
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setConfirmResign(true)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
                >
                  Resign
                </button>
              </div>
            )}
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowShortcuts(true)}
                className="py-1 text-xs text-gray-500 hover:text-gray-300"
              >
                Shortcuts (?)
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="py-1 text-xs text-gray-500 hover:text-gray-300"
                aria-label="Toggle dark mode"
              >
                {darkMode ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark"}
              </button>
            </div>
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
          ...(activeSettings.takeback ? [{ key: "Z", description: "Takeback" }] : []),
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
            <p className="text-gray-500 text-sm mb-2">
              vs {bot ? `${bot.avatar} ${bot.name}` : "Bot"} ({botElo})
            </p>
            {gameOverQuote ? (
              <p className="text-blue-400 text-sm italic mb-4">&ldquo;{gameOverQuote}&rdquo;</p>
            ) : (
              <div className="mb-2" />
            )}
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
                <button
                  onClick={() => router.push(`/game/${gameId}/analysis`)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                >
                  Analyze
                </button>
              )}
              {gameId && isOnline ? (
                <ExportPGN gameId={gameId} compact />
              ) : (
                <button
                  onClick={() => {
                    const pgn = moves
                      .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san))
                      .join(" ");
                    try {
                      navigator.clipboard.writeText(pgn);
                    } catch {}
                  }}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                >
                  Copy PGN
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
