"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { Skeleton } from "@eyeonchess/ui";
import RatingChart from "../../components/stats/RatingChart";
import RecordBar from "../../components/stats/RecordBar";
import OpeningsTable from "../../components/stats/OpeningsTable";
import AccuracyCard from "../../components/stats/AccuracyCard";
import StreakBadge from "../../components/stats/StreakBadge";
import ActivityChart from "../../components/stats/ActivityChart";

interface RatingPoint {
  date: string;
  rating: number;
}

interface OpeningEntry {
  name: string;
  eco: string;
  wins: number;
  losses: number;
  draws: number;
  count: number;
}

interface StatsData {
  rating: { current: number; history: RatingPoint[] };
  record: {
    wins: number;
    losses: number;
    draws: number;
    vsHuman: { wins: number; losses: number; draws: number };
    vsBot: { wins: number; losses: number; draws: number };
  };
  openings: OpeningEntry[];
  accuracy: {
    average: number | null;
    best: { value: number; gameId: string } | null;
    worst: { value: number; gameId: string } | null;
    gamesAnalyzed: number;
  };
  streaks: {
    current: { type: "win" | "loss" | "none"; count: number };
    bestWin: number;
  };
  activity: { date: string; count: number }[];
  totalGames: number;
}

// ── Stats Page ──────────────────────────────────────────
export default function StatsPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .get("/api/v1/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [user]);

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
        <div className="text-center">
          <h1 className="text-2xl font-bold">Stats</h1>
          {stats && (
            <p className="text-gray-400 text-sm mt-1">
              {stats.totalGames} games played &middot; Rating: {stats.rating.current}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-52 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
            <Skeleton className="h-36 rounded-lg" />
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-12">{error}</div>
        ) : stats ? (
          <>
            {/* Rating Chart */}
            <RatingChart history={stats.rating.history} />

            {/* Win/Loss/Draw Records */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">Record</h3>
              <RecordBar label="Overall" {...stats.record} />
              <RecordBar label="vs Humans" {...stats.record.vsHuman} />
              <RecordBar label="vs Bots" {...stats.record.vsBot} />
            </div>

            {/* Two-column grid for accuracy + streaks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AccuracyCard {...stats.accuracy} />
              <StreakBadge {...stats.streaks} />
            </div>

            {/* Openings */}
            <OpeningsTable openings={stats.openings} />

            {/* Activity */}
            <ActivityChart activity={stats.activity} />
          </>
        ) : null}

        <div className="text-center">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Play
          </Link>
        </div>
      </div>
    </main>
  );
}
