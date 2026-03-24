/**
 * The tier determines which engine drives the bot's move selection.
 *
 * - `custom` (200-1200): Pure JS minimax with personality quirks
 * - `hybrid` (1300-1900): Stockfish at limited depth with blunder injection
 * - `engine` (2000+): Stockfish with UCI_Elo limiting
 */
export type BotTier = "custom" | "hybrid" | "engine";

/**
 * Skill category for grouping bots in the UI.
 */
export type BotCategory =
  | "beginner"
  | "novice"
  | "intermediate"
  | "advanced"
  | "expert"
  | "master"
  | "grandmaster";

/**
 * Display labels for bot categories.
 */
export const BOT_CATEGORY_LABELS: Record<BotCategory, { name: string; eloRange: string }> = {
  beginner: { name: "Beginner", eloRange: "200-400" },
  novice: { name: "Novice", eloRange: "500-800" },
  intermediate: { name: "Intermediate", eloRange: "900-1200" },
  advanced: { name: "Advanced", eloRange: "1300-1600" },
  expert: { name: "Expert", eloRange: "1700-2000" },
  master: { name: "Master", eloRange: "2100-2500" },
  grandmaster: { name: "Grandmaster", eloRange: "2600-3200" },
};

/**
 * Get the category for an Elo rating.
 */
export function getBotCategory(elo: number): BotCategory {
  if (elo <= 400) return "beginner";
  if (elo <= 800) return "novice";
  if (elo <= 1200) return "intermediate";
  if (elo <= 1600) return "advanced";
  if (elo <= 2000) return "expert";
  if (elo <= 2500) return "master";
  return "grandmaster";
}

/**
 * Elo color band for UI display.
 */
export type EloBand = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "gold";

/**
 * A bot personality with behavior parameters that control how it plays.
 */
export interface BotPersonality {
  /** Unique slug identifier (e.g. "amir", "timmy") */
  id: string;
  /** Display name */
  name: string;
  /** Target Elo rating */
  elo: number;
  /** One-line personality description */
  description: string;
  /** Emoji avatar */
  avatar: string;
  /** Engine tier */
  tier: BotTier;
  /** Skill category for UI grouping */
  category: BotCategory;

  // ── Behavior parameters ────────────────────────────────

  /** Chance to play a completely random legal move (0-0.5) */
  randomMoveChance: number;
  /** Chance to deliberately miss the best move by 200+ cp (0-0.3) */
  blunderChance: number;
  /** Bias toward capturing pieces even when it's a bad trade (0-1) */
  captureGreed: number;
  /** Preference for attacking (+1) vs defensive (-1) moves (range -1 to 1) */
  aggressionBias: number;
  /** Maximum search depth (1-18) */
  maxDepth: number;
  /** Brings queen out in the first 5 moves */
  queenEarly: boolean;
  /** Pushes random edge pawns */
  pawnPusher: boolean;

  /** Optional chat messages keyed by game event */
  messages?: BotMessages;

  /** Preferred opening move sequences (SAN). Custom tier only. */
  preferredOpenings?: {
    asWhite?: string[];
    asBlack?: string[];
  };
}

// ── Bot chat messages ────────────────────────────────────

/** Game events that can trigger a bot chat message. */
export type BotMessageEvent =
  | "gameStart"
  | "onCapture"
  | "onBeingChecked"
  | "onGivingCheck"
  | "onBlunder"
  | "onPlayerBlunder"
  | "onWinning"
  | "onLosing"
  | "onCheckmate"
  | "onCheckmated"
  | "onDraw";

/** Map of event categories to arrays of possible messages. */
export type BotMessages = Partial<Record<BotMessageEvent, string[]>>;

/**
 * Configuration returned by `getStockfishConfig` for hybrid and engine tier bots.
 */
export interface StockfishBotConfig {
  /** Search depth limit (hybrid tier) */
  depth: number;
  /** Chance to replace best move with a random one (hybrid tier) */
  blunderChance: number;
  /** UCI_Elo value (engine tier, 0 = not limited) */
  uciElo: number;
  /** Think time in ms */
  thinkTime: number;
}

/**
 * Get the UI color band for an Elo rating.
 */
export function getEloBand(elo: number): EloBand {
  if (elo <= 600) return "red";
  if (elo <= 1000) return "orange";
  if (elo <= 1400) return "yellow";
  if (elo <= 1800) return "green";
  if (elo <= 2200) return "blue";
  if (elo <= 2600) return "purple";
  return "gold";
}

/**
 * Tailwind color classes for each Elo band.
 */
export const ELO_BAND_COLORS: Record<EloBand, { bg: string; text: string; ring: string }> = {
  red: { bg: "bg-red-600", text: "text-red-400", ring: "ring-red-500" },
  orange: { bg: "bg-orange-600", text: "text-orange-400", ring: "ring-orange-500" },
  yellow: { bg: "bg-yellow-600", text: "text-yellow-400", ring: "ring-yellow-500" },
  green: { bg: "bg-green-600", text: "text-green-400", ring: "ring-green-500" },
  blue: { bg: "bg-blue-600", text: "text-blue-400", ring: "ring-blue-500" },
  purple: { bg: "bg-purple-600", text: "text-purple-400", ring: "ring-purple-500" },
  gold: { bg: "bg-yellow-500", text: "text-yellow-300", ring: "ring-yellow-400" },
};
