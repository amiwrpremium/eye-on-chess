"use client";

import { REACTIONS, type ReactionType } from "@eyeonchess/chess";

interface ReactionPickerProps {
  onReact: (reaction: ReactionType) => void;
  disabled: boolean;
}

const reactionKeys = Object.keys(REACTIONS) as ReactionType[];

/**
 * Renders a row of emoji reaction buttons that players can use during a live game.
 * Each button shows a tooltip label on hover.
 *
 * @param props - {@link ReactionPickerProps}
 * @returns A horizontal bar of reaction emoji buttons.
 */
export default function ReactionPicker({ onReact, disabled }: ReactionPickerProps) {
  return (
    <div className="flex gap-2 justify-center">
      {reactionKeys.map((key) => {
        const r = REACTIONS[key];
        return (
          <button
            key={key}
            onClick={() => onReact(key)}
            disabled={disabled}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-xl active:scale-110 transition-transform group relative"
            title={r.label}
            aria-label={r.label}
          >
            {r.emoji}
            <span className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded whitespace-nowrap z-10">
              {r.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
