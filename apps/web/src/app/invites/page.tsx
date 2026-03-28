"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { useToast } from "@eyeonchess/ui";

interface InviteItem {
  id: string;
  code: string;
  used: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface InviteStats {
  totalCreated: number;
  totalUsed: number;
  maxAllowed: number;
  remaining: number;
  canCreate: boolean;
  usedTowardNext: number;
  neededForNext: number;
}

export default function InvitesPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const toast = useToast();
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);
  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, statsRes] = await Promise.all([
        api.get("/api/v1/invites"),
        api.get("/api/v1/invites/stats"),
      ]);
      setInvites(invRes.data.invites);
      setStats(statsRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await api.post("/api/v1/invites");
      toast.show(`Invite created: ${data.code.slice(0, 8)}...`);
      await loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to generate invite";
      toast.show(msg, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(code: string) {
    const siteUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost";
    const link = `${siteUrl}/register?invite=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.show("Invite link copied");
    } catch {
      toast.show("Failed to copy", "error");
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.show("Code copied");
    } catch {
      toast.show("Failed to copy", "error");
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const usedPercent =
    stats && stats.totalCreated > 0 ? Math.round((stats.totalUsed / stats.totalCreated) * 100) : 0;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-12">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">My Invites</h1>

        {/* Stats */}
        {stats && (
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center mb-3">
              <div>
                <p className="text-2xl font-bold">{stats.totalCreated}</p>
                <p className="text-xs text-gray-400">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.totalUsed}</p>
                <p className="text-xs text-gray-400">Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.remaining}</p>
                <p className="text-xs text-gray-400">Remaining</p>
              </div>
            </div>
            {/* Progress toward next batch */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>
                  {stats.usedTowardNext}/{stats.neededForNext} used toward next batch
                </span>
                <span>{usedPercent}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${stats.neededForNext > 0 ? Math.min(100, (stats.usedTowardNext / stats.neededForNext) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={generating || !!(stats && !stats.canCreate)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium transition-colors"
        >
          {generating
            ? "Generating..."
            : stats && !stats.canCreate
              ? "Invite limit reached — get more invites used"
              : "Generate New Invite"}
        </button>

        {/* Invite list */}
        {loading ? (
          <p className="text-gray-400 text-center">Loading...</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No invites yet. Generate one above!</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="bg-gray-900 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-300 font-mono truncate">
                      {inv.code.slice(0, 12)}...
                    </code>
                    {inv.used ? (
                      <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                        Used
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                        Unused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {inv.used
                      ? `Used by ${inv.usedBy} on ${new Date(inv.usedAt!).toLocaleDateString()}`
                      : `Created ${new Date(inv.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                {!inv.used && (
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => copyLink(inv.code)}
                      className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-400 hover:text-white text-xs rounded transition-colors"
                    >
                      Link
                    </button>
                    <button
                      onClick={() => copyCode(inv.code)}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs rounded transition-colors"
                    >
                      Code
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
