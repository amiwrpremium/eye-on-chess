/**
 * A reaction definition with display properties.
 */
export interface ReactionDef {
  /** Emoji character */
  emoji: string;
  /** Human-readable label */
  label: string;
  /** Tailwind CSS color class */
  color: string;
}

/**
 * Identifier for a reaction type.
 */
export type ReactionType = "good_move" | "brilliant" | "blunder" | "thinking" | "gg" | "takeback";
