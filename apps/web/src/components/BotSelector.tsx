"use client";

import { useState, useEffect } from "react";
import {
  getEloBand,
  ELO_BAND_COLORS,
  BOT_CATEGORY_LABELS,
  type BotPersonality,
  type BotCategory,
} from "@eyeonchess/chess";

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

const CATEGORY_ORDER: BotCategory[] = [
  "beginner",
  "novice",
  "intermediate",
  "advanced",
  "expert",
  "master",
  "grandmaster",
];

/**
 * Accordion-style bot selector grouped by skill category.
 *
 * Each category (Beginner, Novice, etc.) is a collapsible header showing the
 * category name and Elo range. Click to expand and reveal bot cards inside.
 * Only one category is expanded at a time. The category containing the
 * selected bot auto-expands on mount.
 */
export default function BotSelector({ selected, onSelect, bots }: BotSelectorProps) {
  const grouped = new Map<BotCategory, BotPersonality[]>();
  for (const cat of CATEGORY_ORDER) {
    const catBots = bots.filter((b) => b.category === cat);
    if (catBots.length > 0) grouped.set(cat, catBots);
  }

  const [expanded, setExpanded] = useState<BotCategory | null>(null);

  // Auto-expand the category containing the selected bot
  useEffect(() => {
    if (selected) {
      setExpanded(selected.category);
    }
  }, []);

  function toggle(cat: BotCategory) {
    setExpanded((prev) => (prev === cat ? null : cat));
  }

  return (
    <div className="space-y-1">
      {CATEGORY_ORDER.map((cat) => {
        const catBots = grouped.get(cat);
        if (!catBots) return null;
        const label = BOT_CATEGORY_LABELS[cat];
        const bandColor = ELO_BAND_COLORS[getEloBand(catBots[0].elo)];
        const isOpen = expanded === cat;
        const hasSelected = !!selected && selected.category === cat;

        return (
          <div key={cat}>
            <button
              onClick={() => toggle(cat)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                hasSelected
                  ? "bg-gray-800 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={bandColor.text}>{label.name}</span>
                <span className="text-xs text-gray-500">{label.eloRange}</span>
                {hasSelected && <span className={`w-1.5 h-1.5 rounded-full ${bandColor.bg}`} />}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? "max-h-[600px] mt-1" : "max-h-0"
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-1 pb-1">
                {catBots.map((bot) => {
                  const band = getEloBand(bot.elo);
                  const colors = ELO_BAND_COLORS[band];
                  const isSelected = selected?.id === bot.id;

                  return (
                    <button
                      key={bot.id}
                      onClick={() => onSelect(bot)}
                      className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                        isSelected
                          ? `ring-2 ${colors.ring} bg-gray-800`
                          : "bg-gray-800/60 hover:bg-gray-700/80"
                      }`}
                    >
                      <span className="text-3xl flex-shrink-0" role="img" aria-label={bot.name}>
                        {bot.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white truncate">
                            {bot.name}
                          </span>
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
          </div>
        );
      })}
    </div>
  );
}
