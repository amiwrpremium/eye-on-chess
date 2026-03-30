"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useBotEngine } from "../../../lib/useBotEngine";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import {
  type GameModeSettings,
  type GameModePreset,
  GAME_MODE_PRESETS,
  GAME_MODE_LABELS,
  DEFAULT_CUSTOM,
} from "../../../lib/gameModes";
import {
  syncOfflineGames,
  generateOfflineGameId,
  getPendingCount,
  retryPendingSyncs,
  findInProgressGames,
  clearInProgress,
  type InProgressGame,
} from "../../../lib/offlineSync";
import { ConfirmModal, useToast } from "@eyeonchess/ui";
import { TIME_CONTROL_PRESETS, type BotPersonality } from "@eyeonchess/chess";
import { loadBotPrefs, saveBotPrefs } from "../../../lib/gamePrefs";
import BotSelector from "../../../components/BotSelector";
import TimeControlPicker from "../../../components/TimeControlPicker";

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

export default function PlayBotPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const botEngine = useBotEngine();
  const isOnline = useOnlineStatus();

  // Bot list (fetch from API -> cache to localStorage -> empty until loaded)
  const [botList, setBotList] = useState<BotPersonality[]>(() => {
    try {
      const cached = localStorage.getItem("eyeonchess-bots");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [botsLoading, setBotsLoading] = useState(botList.length === 0);
  useEffect(() => {
    if (isOnline) {
      api
        .get("/api/v1/bots")
        .then(({ data }) => {
          if (data.bots && data.bots.length > 0) {
            setBotList(data.bots);
            try {
              localStorage.setItem("eyeonchess-bots", JSON.stringify(data.bots));
            } catch {}
          }
        })
        .finally(() => setBotsLoading(false));
    } else {
      setBotsLoading(false);
    }
  }, [isOnline]);

  // Selection state
  const [selectedBot, setSelectedBot] = useState<BotPersonality | null>(null);
  const [useCustomElo, setUseCustomElo] = useState(false);
  const [botElo, setBotElo] = useState(800);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [selectedTime, setSelectedTime] = useState("unlimited");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [customIncrement, setCustomIncrement] = useState(0);

  // Game mode
  const [modePreset, setModePreset] = useState<GameModePreset>("friendly");
  const [customSettings, setCustomSettings] = useState<GameModeSettings>({ ...DEFAULT_CUSTOM });

  // Restore last-used settings from localStorage
  useEffect(() => {
    const prefs = loadBotPrefs();
    setColorChoice(prefs.colorChoice);
    setSelectedTime(prefs.selectedTime);
    setShowCustomTime(prefs.showCustomTime);
    setCustomMinutes(prefs.customMinutes);
    setCustomIncrement(prefs.customIncrement);
    setModePreset(prefs.modePreset);
    setCustomSettings(prefs.customSettings);
    setUseCustomElo(prefs.useCustomElo);
    setBotElo(prefs.botElo);
  }, []);

  // UI state
  const [error, setError] = useState("");
  const [confirmStart, setConfirmStart] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [activeGame, setActiveGame] = useState<{ id: string; botElo: number | null } | null>(null);
  const [showActivePrompt, setShowActivePrompt] = useState(false);
  const [savedGames, setSavedGames] = useState<InProgressGame[]>([]);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);
  const toast = useToast();

  // Check for in-progress games to resume
  useEffect(() => {
    setSavedGames(findInProgressGames());
  }, []);
  useEffect(() => {
    setPendingSyncCount(getPendingCount());
    if (isOnline) {
      // Sync offline games
      syncOfflineGames().then(({ failed }) => {
        setPendingSyncCount(getPendingCount());
        if (failed > 0) {
          toast.show(`${failed} game(s) failed to sync — will retry`, "error");
        }
      });
      // Retry any online games that failed to sync moves
      retryPendingSyncs().then(({ synced }) => {
        if (synced > 0) {
          toast.show(`${synced} game(s) synced successfully`, "success");
        }
      });
    }
  }, [isOnline]);
  useEffect(() => {
    if (!user || !isOnline) return;
    api
      .get("/api/v1/games/active")
      .then(({ data }) => {
        if (data.game?.isVsBot) {
          setActiveGame(data.game);
          setShowActivePrompt(true);
        }
      })
      .catch(() => toast.show("Failed to check for active game", "error"));
  }, [user, isOnline]);

  async function resumeGame() {
    if (!activeGame) return;
    setShowActivePrompt(false);
    router.push(`/play/bot/${activeGame.id}`);
  }

  async function resignActiveAndContinue() {
    if (activeGame) {
      try {
        await api.post(`/api/v1/games/${activeGame.id}/resign`);
      } catch {}
    }
    setActiveGame(null);
    setShowActivePrompt(false);
  }

  function getActiveMode(): GameModeSettings {
    return modePreset === "custom"
      ? customSettings
      : GAME_MODE_PRESETS[modePreset as Exclude<GameModePreset, "custom">];
  }

  async function startGame() {
    setError("");
    setConfirmStart(false);
    const isWhite =
      colorChoice === "white" ? true : colorChoice === "black" ? false : Math.random() < 0.5;

    // Store game config in sessionStorage for the game page to read
    const settings = getActiveMode();
    const config = {
      elo: botElo,
      color: isWhite ? "white" : "black",
      mode: modePreset,
      botId: selectedBot?.id || null,
      settings,
    };
    try {
      sessionStorage.setItem("botGameConfig", JSON.stringify(config));
    } catch {}

    saveBotPrefs({
      colorChoice,
      selectedTime,
      showCustomTime,
      customMinutes,
      customIncrement,
      modePreset,
      customSettings,
      useCustomElo,
      botElo,
    });

    if (isOnline) {
      try {
        const body: Record<string, unknown> = {
          botElo,
          color: isWhite ? "white" : "black",
        };
        if (showCustomTime) {
          body.initialTime = customMinutes * 60;
          body.increment = customIncrement;
        } else {
          body.preset = selectedTime;
        }
        const { data } = await api.post("/api/v1/games/bot", body);
        router.push(`/play/bot/${data.game.id}`);
      } catch {
        setError("Failed to create game");
      }
    } else {
      const offId = generateOfflineGameId();
      router.push(`/play/bot/${offId}`);
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const modes: GameModePreset[] = ["challenge", "friendly", "assisted", "custom"];

  return (
    <main className="flex flex-col items-center min-h-screen p-3 pt-6 sm:p-4 sm:pt-12">
      <div className="max-w-lg w-full space-y-4 sm:space-y-5">
        <h1 className="text-2xl font-bold text-center">Play vs Bot</h1>
        {!isOnline && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-2 text-center text-xs text-yellow-300">
            Offline — games sync when you reconnect
          </div>
        )}
        {pendingSyncCount > 0 && isOnline && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-2 text-center text-xs text-green-300">
            Syncing {pendingSyncCount} offline game{pendingSyncCount > 1 ? "s" : ""}...
          </div>
        )}
        {savedGames.length > 0 && !showActivePrompt && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-blue-300 text-center">
              Resume in-progress game{savedGames.length > 1 ? "s" : ""}
            </p>
            {savedGames.slice(0, 3).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-300">
                  <span className="font-mono">Elo {g.botElo}</span>
                  <span className="text-gray-500 ml-2">
                    {g.moves.length} move{g.moves.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/play/bot/${g.id}`)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => {
                      clearInProgress(g.id);
                      setSavedGames((prev) => prev.filter((s) => s.id !== g.id));
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!botEngine.ready && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-300">Loading Stockfish engine...</p>
            <p className="text-xs text-blue-400 mt-1">~7MB download (cached after first load)</p>
          </div>
        )}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {showActivePrompt && activeGame && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-300 mb-3">Active game vs Bot ({activeGame.botElo})</p>
            <div className="flex gap-3">
              <button
                onClick={resumeGame}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
              >
                Continue
              </button>
              <button
                onClick={resignActiveAndContinue}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
              >
                Resign &amp; New
              </button>
            </div>
          </div>
        )}

        {/* Game Mode */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Game Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setModePreset(m)}
                className={`p-3 rounded text-left transition-colors ${modePreset === m ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
              >
                <span className="block text-sm font-medium">{GAME_MODE_LABELS[m].name}</span>
                <span className="block text-xs text-gray-400">{GAME_MODE_LABELS[m].desc}</span>
              </button>
            ))}
          </div>
          {modePreset === "custom" && (
            <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
              {(Object.keys(customSettings) as (keyof GameModeSettings)[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between text-sm cursor-pointer"
                >
                  <span>
                    {key === "evalBar"
                      ? "Evaluation Bar"
                      : key === "moveFeedback"
                        ? "Move Feedback"
                        : key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                  <input
                    type="checkbox"
                    checked={customSettings[key]}
                    onChange={() => setCustomSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="rounded"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Bot Difficulty */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">Bot Difficulty</h2>
            <button
              onClick={() => {
                setUseCustomElo(!useCustomElo);
                if (!useCustomElo) setSelectedBot(null);
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              {useCustomElo ? "Choose a personality" : "Custom Elo"}
            </button>
          </div>
          {botsLoading && botList.length === 0 ? (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : useCustomElo || botList.length === 0 ? (
            <>
              {botList.length === 0 && !isOnline && (
                <p className="text-xs text-gray-500 text-center mb-2">
                  Bot personalities available when online. Using custom Elo.
                </p>
              )}
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
                onChange={(e) => {
                  setBotElo(parseInt(e.target.value));
                  setSelectedBot(null);
                }}
                className="w-full"
              />
            </>
          ) : (
            <BotSelector
              bots={botList}
              selected={selectedBot}
              onSelect={(bot) => {
                setSelectedBot(bot);
                setBotElo(bot.elo);
              }}
            />
          )}
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
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <TimeControlPicker
          selectedTime={showCustomTime ? "custom" : selectedTime}
          showCustomTime={showCustomTime}
          customMinutes={customMinutes}
          customIncrement={customIncrement}
          onSelect={(key) => {
            setSelectedTime(key);
            setShowCustomTime(false);
          }}
          onSelectCustom={(min, inc) => {
            setCustomMinutes(min);
            setCustomIncrement(inc);
            setShowCustomTime(true);
          }}
          onCustomMinutesChange={setCustomMinutes}
          onCustomIncrementChange={setCustomIncrement}
        />

        <button
          onClick={() => setConfirmStart(true)}
          disabled={!botEngine.ready}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait rounded-lg text-lg font-bold transition-colors"
        >
          {botEngine.ready ? "Start Game" : "Loading Engine..."}
        </button>

        <div className="text-center">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm">
            &larr; Back
          </Link>
        </div>

        <ConfirmModal
          open={confirmStart}
          title="Start Game?"
          message={`Mode: ${GAME_MODE_LABELS[modePreset].name}\nBot: ${selectedBot ? `${selectedBot.avatar} ${selectedBot.name}` : "Custom"} (${botElo} - ${eloLabel(botElo)})\nColor: ${colorChoice}\nTime: ${showCustomTime ? `${customMinutes}+${customIncrement}` : TIME_CONTROL_PRESETS[selectedTime]?.label || selectedTime}${!isOnline ? "\n\nOffline — will sync later" : ""}`}
          confirmLabel="Start"
          confirmVariant="primary"
          onConfirm={startGame}
          onCancel={() => setConfirmStart(false)}
        />
      </div>
    </main>
  );
}
