"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import api from "../lib/api";
import type { ActivityEvent } from "@eyeonchess/chess";

const ICONS: Record<string, string> = {
  game_won: "🏆",
  game_lost: "😔",
  game_draw: "🤝",
  game_analyzed: "🔍",
  friend_added: "👋",
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Renders a collapsible feed of recent user activity events (wins, losses, draws,
 * analysis, friend requests) fetched from the API and auto-refreshed every 60 seconds.
 *
 * @returns The activity feed panel, or null while loading or when empty.
 */
export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await api.get("/api/v1/feed");
      setEvents(data.events);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 60000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  if (loading) return null;
  if (events.length === 0) return null;

  const displayed = expanded ? events : events.slice(0, 3);

  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-400 mb-2"
      >
        <span>Recent Activity</span>
        <span className="text-xs">{expanded ? "Show less" : `${events.length} events`}</span>
      </button>
      <div className="space-y-1.5">
        {displayed.map((event, i) => {
          const content = (
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5">{ICONS[event.type] || "•"}</span>
              <span className="text-gray-300 flex-1">{event.message}</span>
              <span className="text-gray-600 shrink-0 whitespace-nowrap">
                {relativeTime(event.timestamp)}
              </span>
            </div>
          );

          if (event.link) {
            return (
              <Link
                key={i}
                href={event.link}
                className="block p-1.5 rounded hover:bg-gray-800 transition-colors"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={i} className="p-1.5">
              {content}
            </div>
          );
        })}
      </div>
      {events.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-xs text-blue-400 hover:underline mt-1"
        >
          Show all ({events.length})
        </button>
      )}
    </div>
  );
}
