/**
 * Categorization of a game's time control.
 */
export type TimeControl = "BULLET" | "BLITZ" | "RAPID" | "CLASSICAL" | "UNLIMITED";

/**
 * A time control preset with display label, category, and clock settings.
 */
export interface TimeControlPreset {
  /** Display label (e.g. "5+0", "10+0") */
  label: string;
  /** Time control category */
  timeControl: TimeControl;
  /** Initial time in seconds */
  initialTime: number;
  /** Increment in seconds */
  increment: number;
}
