"use client";

import { getEloBand, ELO_BAND_COLORS, type BotPersonality } from "@eyeonchess/chess";

/**
 * Props for the {@link BotSelector} component.
 */
interface BotSelectorProps {
  /** The currently selected bot personality, or `null` if none. */
  selected: BotPersonality | null;
  /** Callback fired when the user clicks a bot card. */
  onSelect: (bot: BotPersonality) => void;
  /** The list of bot personalities to display. */
  bots: BotPersonality[];
}

/**
 * A scrollable grid of bot personality cards for selecting an opponent.
 *
 * Each card displays the bot's emoji avatar, name, Elo badge (colored by
 * {@link getEloBand}), and a one-line description. The selected bot receives
 * a colored ring matching its Elo band.
 *
 * Responsive layout: 1 column on small, 2 on medium, 3 on large screens.
 * Uses dark theme Tailwind classes consistent with the rest of the app.
 */
export default function BotSelector({ selected, onSelect, bots }: BotSelectorProps) {
  return (
    <div className="max-h-[420px] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {bots.map((bot) => {
          const band = getEloBand(bot.elo);
          const colors = ELO_BAND_COLORS[band];
          const isSelected = selected?.id === bot.id;

          return (
            <button
              key={bot.id}
              onClick={() => onSelect(bot)}
              className={`
                flex items-center gap-3 p-3 rounded-lg text-left transition-all
                ${isSelected ? `ring-2 ${colors.ring} bg-gray-800` : "bg-gray-800/60 hover:bg-gray-700/80"}
              `}
            >
              {/* Avatar */}
              <span className="text-3xl flex-shrink-0" role="img" aria-label={bot.name}>
                {bot.avatar}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white truncate">{bot.name}</span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${colors.bg} text-white`}
                  >
                    {bot.elo}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{bot.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
