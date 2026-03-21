"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { Skeleton } from "../../components/Skeleton";

interface GameRecord {
  id: string;
  status: string;
  result: string | null;
  termination: string | null;
  timeControl: string;
  isVsBot: boolean;
  botElo: number | null;
  createdAt: string;
  endedAt: string | null;
  whiteId: string | null;
  blackId: string | null;
  white: { username: string; rating: number } | null;
  black: { username: string; rating: number } | null;
}

const RESULT_LABELS: Record<string, string> = {
  WHITE_WIN: "White Won",
  BLACK_WIN: "Black Won",
  DRAW: "Draw",
  ABORTED: "Aborted",
};

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/games/history?page=${page}&limit=20`);
      setGames(data.games);
      setTotalPages(data.pagination.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (user) loadGames();
  }, [user, loadGames]);

  function getOpponent(g: GameRecord): string {
    if (g.isVsBot) return `Bot (${g.botElo})`;
    if (!user) return "?";
    if (g.whiteId === user.id) return g.black?.username || "?";
    return g.white?.username || "?";
  }

  function getPlayerResult(g: GameRecord): "win" | "loss" | "draw" | "aborted" {
    if (!g.result || g.result === "ABORTED") return "aborted";
    if (g.result === "DRAW") return "draw";
    if (!user) return "draw";
    const playerIsWhite = g.whiteId === user.id;
    if ((g.result === "WHITE_WIN" && playerIsWhite) || (g.result === "BLACK_WIN" && !playerIsWhite))
      return "win";
    return "loss";
  }

  const resultColors: Record<string, string> = {
    win: "text-green-400",
    loss: "text-red-400",
    draw: "text-gray-400",
    aborted: "text-gray-500",
  };

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-12">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Game History</h1>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>No games played yet.</p>
            <Link href="/play" className="text-blue-400 hover:underline mt-2 inline-block">
              Play a game
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {games.map((g) => {
                const pr = getPlayerResult(g);
                return (
                  <div
                    key={g.id}
                    className="bg-gray-900 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${resultColors[pr]}`}>
                          {pr === "win" ? "W" : pr === "loss" ? "L" : pr === "draw" ? "D" : "—"}
                        </span>
                        <span className="font-medium text-sm truncate">vs {getOpponent(g)}</span>
                        <span className="text-xs text-gray-500">{g.timeControl}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {RESULT_LABELS[g.result || ""] || g.status}
                        {g.termination && ` — ${g.termination.toLowerCase()}`}
                        <span className="ml-2">{new Date(g.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-2">
                      <Link
                        href={`/game/${g.id}/analysis`}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                      >
                        Analyze
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Play
          </Link>
        </div>
      </div>
    </main>
  );
}
