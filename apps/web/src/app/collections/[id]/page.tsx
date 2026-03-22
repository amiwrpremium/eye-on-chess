"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import GameNoteEditor from "../../../components/GameNoteEditor";

interface GameRecord {
  id: string;
  result: string | null;
  timeControl: string;
  isVsBot: boolean;
  botElo: number | null;
  createdAt: string;
  whiteId: string | null;
  blackId: string | null;
  white: { username: string; rating: number } | null;
  black: { username: string; rating: number } | null;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;
  const { user, isLoading, fetchMe } = useAuthStore();
  const [name, setName] = useState("");
  const [games, setGames] = useState<GameRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/collections/${collectionId}/games?page=${page}`);
      setName(data.collection.name);
      setGames(data.games);
      setTotalPages(data.pagination.totalPages);
    } catch {
      router.push("/collections");
    } finally {
      setLoading(false);
    }
  }, [collectionId, page, router]);

  useEffect(() => {
    if (user) loadGames();
  }, [user, loadGames]);

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
        <h1 className="text-2xl font-bold text-center">
          {name === "Favorites" ? "❤️ " : ""}
          {name}
        </h1>

        {loading ? (
          <p className="text-gray-400 text-center">Loading...</p>
        ) : games.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No games in this collection yet.</p>
        ) : (
          <div className="space-y-2">
            {games.map((g) => (
              <div
                key={g.id}
                className="bg-gray-900 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {g.white?.username || "?"} vs{" "}
                    {g.black?.username || (g.isVsBot ? `Bot (${g.botElo})` : "?")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {g.result || "—"} &middot; {g.timeControl} &middot;{" "}
                    {new Date(g.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <GameNoteEditor gameId={g.id} compact />
                <Link
                  href={`/game/${g.id}/analysis`}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                >
                  Analyze
                </Link>
              </div>
            ))}
          </div>
        )}

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

        <div className="text-center">
          <Link href="/collections" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Collections
          </Link>
        </div>
      </div>
    </main>
  );
}
