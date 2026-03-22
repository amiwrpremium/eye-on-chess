import type { ReactionDef, ReactionType } from "./types.js";

/**
 * All available emoji reactions for live games.
 */
export const REACTIONS: Record<ReactionType, ReactionDef> = {
  good_move: { emoji: "\u{1F44D}", label: "Good Move!", color: "text-green-400" },
  brilliant: { emoji: "\u{2728}", label: "Brilliant!", color: "text-cyan-400" },
  blunder: { emoji: "\u{1F926}", label: "Blunder!", color: "text-red-400" },
  thinking: { emoji: "\u{1F914}", label: "Hmm...", color: "text-yellow-400" },
  gg: { emoji: "\u{1F91D}", label: "GG", color: "text-blue-400" },
  takeback: { emoji: "\u{23EA}", label: "Take it back!", color: "text-orange-400" },
};

/**
 * Array of valid reaction type identifiers, for validation.
 */
export const VALID_REACTIONS: ReactionType[] = Object.keys(REACTIONS) as ReactionType[];
