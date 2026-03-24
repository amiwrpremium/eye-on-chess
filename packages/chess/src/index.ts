/**
 * @packageDocumentation
 * Shared chess types, constants, and helpers used by both the API and web app.
 *
 * Organized by domain:
 * - `game/` — game results, statuses, terminations
 * - `time-control/` — time control presets and categorization
 * - `moves/` — move records and classification
 * - `player/` — player profiles, roles, clock state
 * - `openings/` — ECO opening database and lookup
 * - `reactions/` — emoji reactions for live games
 * - `activity/` — activity feed event types
 */

// ── Game ──────────────────────────────────────────────────
export type { GameResult, GameStatus, Termination } from "./game/index";
export {
  RESULT_PGN,
  RESULT_LABELS,
  TERMINATION_LABELS,
  didPlayerWin,
  didPlayerLose,
  isDrawResult,
} from "./game/index";

// ── Time Control ──────────────────────────────────────────
export type { TimeControl, TimeControlPreset } from "./time-control/index";
export { TIME_CONTROL_PRESETS, categorizeTimeControl } from "./time-control/index";

// ── Moves ─────────────────────────────────────────────────
export type { MoveClassification, MoveRecord } from "./moves/index";
export { CLASSIFICATION_COLORS, CLASSIFICATION_SYMBOLS } from "./moves/index";

// ── Player ────────────────────────────────────────────────
export type { UserRole, FriendshipStatus, Player, ClockState } from "./player/index";

// ── Openings ──────────────────────────────────────────────
export type { OpeningEntry, Opening } from "./openings/index";
export { ECO_DATABASE, lookupOpening } from "./openings/index";

// ── Reactions ─────────────────────────────────────────────
export type { ReactionDef, ReactionType } from "./reactions/index";
export { REACTIONS, VALID_REACTIONS } from "./reactions/index";

// ── Activity ──────────────────────────────────────────────
export type { ActivityEventType, ActivityEvent } from "./activity/index";

// ── Bots ──────────────────────────────────────────────────
export type {
  BotPersonality,
  BotTier,
  EloBand,
  BotCategory,
  StockfishBotConfig,
  BotMessageEvent,
  BotMessages,
  ThinkTimeContext,
} from "./bots/index";
export {
  getEloBand,
  ELO_BAND_COLORS,
  getBotCategory,
  BOT_CATEGORY_LABELS,
  computeCustomMove,
  getStockfishConfig,
  computeThinkTime,
  getOpeningMove,
} from "./bots/index";

// ── Legacy types (kept for backwards compat) ─────────────
/** @deprecated Use specific types from their domains instead */
export type Color = "white" | "black";
export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export interface Piece {
  color: Color;
  type: PieceType;
}
