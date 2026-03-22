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
export type { GameResult, GameStatus, Termination } from "./game/index.js";
export {
  RESULT_PGN,
  RESULT_LABELS,
  TERMINATION_LABELS,
  didPlayerWin,
  didPlayerLose,
  isDrawResult,
} from "./game/index.js";

// ── Time Control ──────────────────────────────────────────
export type { TimeControl, TimeControlPreset } from "./time-control/index.js";
export { TIME_CONTROL_PRESETS, categorizeTimeControl } from "./time-control/index.js";

// ── Moves ─────────────────────────────────────────────────
export type { MoveClassification, MoveRecord } from "./moves/index.js";
export { CLASSIFICATION_COLORS, CLASSIFICATION_SYMBOLS } from "./moves/index.js";

// ── Player ────────────────────────────────────────────────
export type { UserRole, FriendshipStatus, Player, ClockState } from "./player/index.js";

// ── Openings ──────────────────────────────────────────────
export type { OpeningEntry, Opening } from "./openings/index.js";
export { ECO_DATABASE, lookupOpening } from "./openings/index.js";

// ── Reactions ─────────────────────────────────────────────
export type { ReactionDef, ReactionType } from "./reactions/index.js";
export { REACTIONS, VALID_REACTIONS } from "./reactions/index.js";

// ── Activity ──────────────────────────────────────────────
export type { ActivityEventType, ActivityEvent } from "./activity/index.js";

// ── Legacy types (kept for backwards compat) ─────────────
/** @deprecated Use specific types from their domains instead */
export type Color = "white" | "black";
export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export interface Piece {
  color: Color;
  type: PieceType;
}
