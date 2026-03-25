"use client";

import { useRef, useState, useCallback } from "react";
import type { ActiveReaction } from "../components/ReactionOverlay";
import type { ReactionType } from "@eyeonchess/chess";
import type { BotPersonality } from "@eyeonchess/chess";

export type BotReactionEvent =
  | "botCapture"
  | "botCheck"
  | "botInCheck"
  | "playerGoodMove"
  | "playerBlunder"
  | "thinking"
  | "gameEnd";

const MAX_ACTIVE = 5;
const COOLDOWN_MS = 8000;

/**
 * Maps a bot reaction event + personality to a reaction type and probability.
 * Returns null if the bot shouldn't react.
 */
function getReaction(
  event: BotReactionEvent,
  p: BotPersonality
): { reaction: ReactionType; probability: number } | null {
  const confusion = p.randomMoveChance + p.blunderChance;

  switch (event) {
    case "botCapture":
      return { reaction: "brilliant", probability: p.captureGreed * 0.5 };
    case "botCheck":
      return { reaction: "brilliant", probability: Math.max(p.aggressionBias, 0) * 0.4 };
    case "botInCheck":
      return { reaction: "thinking", probability: confusion * 0.6 };
    case "playerGoodMove":
      return { reaction: "good_move", probability: 0.15 };
    case "playerBlunder":
      return { reaction: "blunder", probability: p.elo < 1200 ? 0.3 : 0.1 };
    case "thinking":
      return { reaction: "thinking", probability: confusion * 0.3 };
    case "gameEnd":
      return { reaction: "gg", probability: 0.8 };
    default:
      return null;
  }
}

export function useBotReactions() {
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);
  const lastReactionTime = useRef(0);

  const triggerReaction = useCallback((event: BotReactionEvent, personality: BotPersonality) => {
    const mapping = getReaction(event, personality);
    if (!mapping) return;

    // Rate limit (gameEnd bypasses cooldown)
    const now = Date.now();
    if (event !== "gameEnd" && now - lastReactionTime.current < COOLDOWN_MS) return;

    // Probability gate
    if (Math.random() > mapping.probability) return;

    lastReactionTime.current = now;
    setActiveReactions((prev) => [
      ...prev.slice(-(MAX_ACTIVE - 1)),
      {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        reaction: mapping.reaction,
        fromOpponent: true,
        timestamp: now,
        xOffset: 15 + Math.random() * 70,
      },
    ]);
  }, []);

  const removeReaction = useCallback((id: string) => {
    setActiveReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearReactions = useCallback(() => {
    setActiveReactions([]);
  }, []);

  return { activeReactions, triggerReaction, removeReaction, clearReactions };
}
