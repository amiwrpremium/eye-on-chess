"use client";

import { useRef, useState, useCallback } from "react";
import type { BotMessages, BotMessageEvent } from "@eyeonchess/chess";

interface UseBotChatOptions {
  messages?: BotMessages;
  /** Probability of showing a message (0-1). Default 0.6. */
  probability?: number;
  /** Minimum time between messages in ms. Default 5000. */
  cooldownMs?: number;
  /** How long a message stays visible in ms. Default 3000. */
  displayMs?: number;
}

interface UseBotChatReturn {
  currentMessage: string | null;
  triggerMessage: (event: BotMessageEvent) => void;
  clearMessage: () => void;
}

/** Always-show events bypass the probability gate. */
const ALWAYS_SHOW: BotMessageEvent[] = ["gameStart", "onCheckmate", "onCheckmated"];

export function useBotChat({
  messages,
  probability = 0.6,
  cooldownMs = 5000,
  displayMs = 3000,
}: UseBotChatOptions): UseBotChatReturn {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const lastMessageTime = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerMessage = useCallback(
    (event: BotMessageEvent) => {
      if (!messages) return;
      const pool = messages[event];
      if (!pool || pool.length === 0) return;

      const now = Date.now();
      if (now - lastMessageTime.current < cooldownMs) return;

      if (!ALWAYS_SHOW.includes(event) && Math.random() > probability) return;

      const msg = pool[Math.floor(Math.random() * pool.length)];
      lastMessageTime.current = now;
      setCurrentMessage(msg);

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        setCurrentMessage(null);
      }, displayMs);
    },
    [messages, probability, cooldownMs, displayMs]
  );

  const clearMessage = useCallback(() => {
    setCurrentMessage(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  return { currentMessage, triggerMessage, clearMessage };
}
