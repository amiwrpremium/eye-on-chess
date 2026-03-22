/**
 * Type of activity event shown in the activity feed.
 */
export type ActivityEventType =
  | "game_won"
  | "game_lost"
  | "game_draw"
  | "game_analyzed"
  | "friend_added";

/**
 * A single event in the activity feed.
 */
export interface ActivityEvent {
  /** Event category */
  type: ActivityEventType;
  /** Human-readable description */
  message: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Link to the related page (e.g. game analysis) */
  link: string | null;
  /** Usernames involved in the event */
  usernames: string[];
}
