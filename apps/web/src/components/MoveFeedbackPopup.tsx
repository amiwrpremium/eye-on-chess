"use client";

import { useEffect, useState } from "react";

interface MoveFeedbackPopupProps {
  classification: string | null;
}

const LABELS: Record<string, { text: string; color: string }> = {
  BRILLIANT: { text: "Brilliant!!", color: "text-cyan-400" },
  GREAT: { text: "Great Move!", color: "text-blue-400" },
  BEST: { text: "Best Move", color: "text-green-400" },
  EXCELLENT: { text: "Excellent", color: "text-green-300" },
  GOOD: { text: "Good", color: "text-gray-300" },
  INACCURACY: { text: "Inaccuracy", color: "text-yellow-400" },
  MISTAKE: { text: "Mistake", color: "text-orange-400" },
  BLUNDER: { text: "Blunder!", color: "text-red-400" },
  FORCED: { text: "Forced", color: "text-gray-500" },
  BOOK: { text: "Book Move", color: "text-purple-400" },
};

export default function MoveFeedbackPopup({ classification }: MoveFeedbackPopupProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (classification) {
      setCurrent(classification);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [classification]);

  if (!current || !LABELS[current]) return null;

  const label = LABELS[current];

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-gray-900/90 backdrop-blur transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <p className={`text-lg font-bold ${label.color}`}>{label.text}</p>
    </div>
  );
}
