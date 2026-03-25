"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/adminApi";
import { Skeleton } from "../../components/Skeleton";

interface DashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    newUsersWeek: number;
    totalGames: number;
    activeGames: number;
    completedGames: number;
    abortedGames: number;
    gamesToday: number;
    gamesWeek: number;
    gamesMonth: number;
    botGames: number;
    humanGames: number;
    analysisQueueDepth: number;
    onlineCount: number;
    enabledBots: number;
    totalBots: number;
  };
  resultDistribution: { result: string; count: number }[];
  timeControlDistribution: { timeControl: string; count: number }[];
  topBots: { name: string; avatar: string; elo: number; games: number }[];
  recentAudit: { action: string; admin: string; createdAt: string }[];
  settings: {
    siteName: string;
    registrationOpen: boolean;
    maxUsers: number;
    requireEmailVerification: boolean;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatCard({
  label,
  value,
  sub,
  color = "text-white",
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarSegment({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-gray-400 text-xs">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-xs text-gray-400">
        {value} ({pct}%)
      </span>
    </div>
  );
}

function QueueBadge({ depth }: { depth: number }) {
  const color =
    depth === 0
      ? "bg-green-900 text-green-300"
      : depth <= 5
        ? "bg-green-900 text-green-300"
        : depth <= 10
          ? "bg-yellow-900 text-yellow-300"
          : "bg-red-900 text-red-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {depth === 0 ? "Empty" : `${depth} pending`}
    </span>
  );
}

const RESULT_COLORS: Record<string, string> = {
  WHITE_WIN: "bg-white",
  BLACK_WIN: "bg-gray-500",
  DRAW: "bg-blue-500",
  ABORTED: "bg-red-500",
};

const RESULT_LABELS: Record<string, string> = {
  WHITE_WIN: "White wins",
  BLACK_WIN: "Black wins",
  DRAW: "Draw",
  ABORTED: "Aborted",
};

const TC_COLORS: Record<string, string> = {
  BULLET: "bg-red-500",
  BLITZ: "bg-orange-500",
  RAPID: "bg-yellow-500",
  CLASSICAL: "bg-green-500",
  UNLIMITED: "bg-blue-500",
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminRequest("get", "/api/v1/admin/dashboard")
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-red-400">Failed to load dashboard.</p>;

  const { stats, resultDistribution, timeControlDistribution, topBots, recentAudit, settings } =
    data;
  const verifiedPct =
    stats.totalUsers > 0 ? ((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(0) : "0";
  const totalCompleted = resultDistribution.reduce((s, r) => s + r.count, 0);
  const totalTC = timeControlDistribution.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Section 1: Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          color="text-blue-400"
          sub={`${verifiedPct}% verified`}
        />
        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          color="text-green-400"
          sub={`of ${stats.totalUsers}`}
        />
        <StatCard label="Online Now" value={stats.onlineCount} color="text-emerald-400" />
        <StatCard label="Active Games" value={stats.activeGames} color="text-yellow-400" />
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Analysis Queue</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-orange-400">{stats.analysisQueueDepth}</p>
            <QueueBadge depth={stats.analysisQueueDepth} />
          </div>
        </div>
      </div>

      {/* Section 2: Activity Snapshot */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Activity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="New Users (7d)" value={stats.newUsersWeek} color="text-cyan-400" />
          <StatCard label="Games Today" value={stats.gamesToday} color="text-purple-400" />
          <StatCard label="Games This Week" value={stats.gamesWeek} color="text-purple-300" />
          <StatCard label="Games This Month" value={stats.gamesMonth} color="text-purple-200" />
        </div>
      </div>

      {/* Section 3: Game Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Result Distribution */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Game Results</h3>
          {totalCompleted === 0 ? (
            <p className="text-gray-500 text-sm">No completed games yet</p>
          ) : (
            <div className="space-y-2">
              {["WHITE_WIN", "BLACK_WIN", "DRAW"].map((result) => {
                const entry = resultDistribution.find((r) => r.result === result);
                return (
                  <BarSegment
                    key={result}
                    label={RESULT_LABELS[result] || result}
                    value={entry?.count || 0}
                    total={totalCompleted}
                    color={RESULT_COLORS[result] || "bg-gray-500"}
                  />
                );
              })}
            </div>
          )}
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
            <span>Completed: {stats.completedGames}</span>
            <span>Aborted: {stats.abortedGames}</span>
            <span>Total: {stats.totalGames}</span>
          </div>
        </div>

        {/* Time Control Distribution */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Time Controls</h3>
          {totalTC === 0 ? (
            <p className="text-gray-500 text-sm">No games yet</p>
          ) : (
            <div className="space-y-2">
              {["BULLET", "BLITZ", "RAPID", "CLASSICAL", "UNLIMITED"].map((tc) => {
                const entry = timeControlDistribution.find((t) => t.timeControl === tc);
                if (!entry || entry.count === 0) return null;
                return (
                  <BarSegment
                    key={tc}
                    label={tc.charAt(0) + tc.slice(1).toLowerCase()}
                    value={entry.count}
                    total={totalTC}
                    color={TC_COLORS[tc] || "bg-gray-500"}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bot vs Human + Bots Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bot vs Human */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Bot vs Human Games</h3>
          {stats.totalGames === 0 ? (
            <p className="text-gray-500 text-sm">No games yet</p>
          ) : (
            <>
              <BarSegment
                label="vs Bot"
                value={stats.botGames}
                total={stats.totalGames}
                color="bg-cyan-500"
              />
              <div className="mt-2">
                <BarSegment
                  label="vs Human"
                  value={stats.humanGames}
                  total={stats.totalGames}
                  color="bg-green-500"
                />
              </div>
            </>
          )}
          <p className="text-xs text-gray-500 mt-3">
            {stats.enabledBots}/{stats.totalBots} bots enabled
          </p>
        </div>

        {/* Top Bots */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Most Played Bots</h3>
          {topBots.length === 0 ? (
            <p className="text-gray-500 text-sm">No bot games yet</p>
          ) : (
            <div className="space-y-2">
              {topBots.map((bot, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>
                    {bot.avatar} {bot.name} <span className="text-gray-500">({bot.elo})</span>
                  </span>
                  <span className="text-gray-400">{bot.games} games</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Admin Actions */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Recent Admin Actions</h3>
          {recentAudit.length === 0 ? (
            <p className="text-gray-500 text-sm">No actions yet</p>
          ) : (
            <div className="space-y-2">
              {recentAudit.map((entry, i) => (
                <div key={i} className="text-xs">
                  <span className="text-gray-300">{entry.action}</span>
                  <span className="text-gray-500">
                    {" "}
                    by {entry.admin} &middot; {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Site Status */}
      {settings && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Site Status</h3>
          <div className="flex flex-wrap gap-3">
            <span
              className={`px-3 py-1 rounded text-xs font-medium ${settings.registrationOpen ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
            >
              Registration: {settings.registrationOpen ? "Open" : "Closed"}
            </span>
            <span className="px-3 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300">
              Max Users: {settings.maxUsers === 0 ? "Unlimited" : settings.maxUsers}
            </span>
            <span
              className={`px-3 py-1 rounded text-xs font-medium ${settings.requireEmailVerification ? "bg-yellow-900 text-yellow-300" : "bg-gray-800 text-gray-300"}`}
            >
              Email Verification: {settings.requireEmailVerification ? "Required" : "Off"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
