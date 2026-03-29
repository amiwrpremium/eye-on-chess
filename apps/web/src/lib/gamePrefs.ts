import type { GameModePreset, GameModeSettings } from "./gameModes";
import { DEFAULT_CUSTOM } from "./gameModes";

const BOT_KEY = "eyeonchess-bot-prefs";
const FRIEND_KEY = "eyeonchess-friend-prefs";

export interface BotGamePrefs {
  colorChoice: "white" | "black" | "random";
  selectedTime: string;
  showCustomTime: boolean;
  customMinutes: number;
  customIncrement: number;
  modePreset: GameModePreset;
  customSettings: GameModeSettings;
  useCustomElo: boolean;
  botElo: number;
}

export interface FriendGamePrefs {
  lastTimeControl: string | null;
  showCustom: boolean;
  customMinutes: number;
  customIncrement: number;
}

const DEFAULT_BOT_PREFS: BotGamePrefs = {
  colorChoice: "white",
  selectedTime: "unlimited",
  showCustomTime: false,
  customMinutes: 10,
  customIncrement: 0,
  modePreset: "friendly",
  customSettings: { ...DEFAULT_CUSTOM },
  useCustomElo: false,
  botElo: 800,
};

const DEFAULT_FRIEND_PREFS: FriendGamePrefs = {
  lastTimeControl: null,
  showCustom: false,
  customMinutes: 10,
  customIncrement: 0,
};

export function loadBotPrefs(): BotGamePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_BOT_PREFS };
  try {
    const stored = localStorage.getItem(BOT_KEY);
    if (!stored) return { ...DEFAULT_BOT_PREFS };
    return { ...DEFAULT_BOT_PREFS, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_BOT_PREFS };
  }
}

export function saveBotPrefs(prefs: BotGamePrefs): void {
  try {
    localStorage.setItem(BOT_KEY, JSON.stringify(prefs));
  } catch {}
}

export function loadFriendPrefs(): FriendGamePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_FRIEND_PREFS };
  try {
    const stored = localStorage.getItem(FRIEND_KEY);
    if (!stored) return { ...DEFAULT_FRIEND_PREFS };
    return { ...DEFAULT_FRIEND_PREFS, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_FRIEND_PREFS };
  }
}

export function saveFriendPrefs(prefs: FriendGamePrefs): void {
  try {
    localStorage.setItem(FRIEND_KEY, JSON.stringify(prefs));
  } catch {}
}
