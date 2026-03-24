"use client";

import { useEffect, useState } from "react";

interface BotChatBubbleProps {
  message: string | null;
}

export default function BotChatBubble({ message }: BotChatBubbleProps) {
  const [displayText, setDisplayText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setDisplayText(message);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setDisplayText(null), 300);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!displayText) return null;

  return (
    <div
      className={`
        z-20 ml-2 px-3 py-2 rounded-xl bg-blue-600 border border-blue-500
        text-sm text-white max-w-[240px] shadow-lg transition-all duration-300
        ${visible ? "opacity-100 scale-100" : "opacity-0 scale-90"}
      `}
    >
      {displayText}
    </div>
  );
}
