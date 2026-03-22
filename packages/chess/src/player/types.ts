/**
 * User role within the platform.
 */
export type UserRole = "USER" | "ADMIN";

/**
 * Friendship lifecycle status.
 */
export type FriendshipStatus = "PENDING" | "ACCEPTED" | "DECLINED";

/**
 * A player's public profile, as returned by game and profile endpoints.
 */
export interface Player {
  /** Unique user ID */
  id: string;
  /** Display name */
  username: string;
  /** Current Elo rating */
  rating: number;
  /** Avatar image URL, if set */
  avatarUrl?: string | null;
}

/**
 * Real-time clock state for a timed game.
 */
export interface ClockState {
  /** White's remaining time in milliseconds */
  whiteTimeLeft: number;
  /** Black's remaining time in milliseconds */
  blackTimeLeft: number;
  /** Epoch timestamp (ms) of the last move */
  lastMoveTimestamp: number;
  /** Which player's clock is running */
  turn: "white" | "black";
  /** Increment per move in milliseconds */
  increment: number;
}
