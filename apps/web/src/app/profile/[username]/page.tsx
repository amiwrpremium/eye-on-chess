"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import CollectionPicker from "../../../components/CollectionPicker";
import StreakBadge from "../../../components/stats/StreakBadge";

interface RecentGame {
  id: string;
  result: string | null;
  termination: string | null;
  timeControl: string;
  createdAt: string;
  whiteId: string | null;
  blackId: string | null;
  white: { username: string } | null;
  black: { username: string } | null;
}

interface UserProfile {
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
  createdAt: string;
  stats: { wins: number; losses: number; draws: number; total: number };
  recentGames: RecentGame[];
  isH2H: boolean;
}

type FriendshipState = "none" | "pending" | "friends" | "incoming";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { user: currentUser, fetchMe } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendState, setFriendState] = useState<FriendshipState>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [h2hMode, setH2hMode] = useState(true);
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<{
    current: { type: "win" | "loss" | "none"; count: number };
    bestWin: number;
  } | null>(null);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const isOther = currentUser && currentUser.username !== username;
        const vsParam = isOther && h2hMode ? `?vsUserId=${currentUser.id}` : "";
        const { data } = await api.get(`/api/v1/users/${username}${vsParam}`);
        setProfile(data.user);

        if (currentUser && data.user.id !== currentUser.id) {
          const [friendsRes, requestsRes] = await Promise.all([
            api.get("/api/v1/friends"),
            api.get("/api/v1/friends/requests"),
          ]);
          const friend = friendsRes.data.friends.find(
            (f: { id: string; friendshipId: string }) => f.id === data.user.id
          );
          if (friend) {
            setFriendState("friends");
            setFriendshipId(friend.friendshipId);
            return;
          }
          const incoming = requestsRes.data.requests.find(
            (r: { id: string; friendshipId: string }) => r.id === data.user.id
          );
          if (incoming) {
            setFriendState("incoming");
            setFriendshipId(incoming.friendshipId);
            return;
          }
          setFriendState("none");
        }
      } catch {
        setError("User not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, currentUser, h2hMode]);

  // Fetch streaks for own profile
  useEffect(() => {
    if (!isOwnProfile) return;
    api
      .get("/api/v1/stats")
      .then(({ data }) => {
        if (data.streaks) setStreaks(data.streaks);
      })
      .catch(() => {});
  }, [isOwnProfile]);

  async function sendRequest() {
    setActionLoading(true);
    try {
      await api.post("/api/v1/friends/request", { username });
      setFriendState("pending");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to send request";
      if (msg.includes("pending")) setFriendState("pending");
      else setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function acceptRequest() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await api.post("/api/v1/friends/accept", { friendshipId });
      setFriendState("friends");
    } catch {
      setError("Failed to accept");
    } finally {
      setActionLoading(false);
    }
  }

  async function removeFriend() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/v1/friends/${friendshipId}`);
      setFriendState("none");
      setFriendshipId(null);
    } catch {
      setError("Failed to remove");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error || "User not found"}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-12">
      <div className="max-w-lg w-full space-y-4">
        {/* Header */}
        <div className="bg-gray-900 rounded-lg p-6 text-center">
          <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
            {profile.username[0].toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{profile.username}</h1>
          <p className="text-gray-400 text-sm">
            Joined {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* H2H toggle (only when viewing other profile while logged in) */}
        {currentUser && !isOwnProfile && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setH2hMode(true)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                h2hMode ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              vs Me
            </button>
            <button
              onClick={() => setH2hMode(false)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                !h2hMode ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              All Games
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded p-3 text-center">
            <p className="text-2xl font-bold">{profile.rating}</p>
            <p className="text-gray-400 text-xs">Rating</p>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <p className="text-2xl font-bold">{profile.stats.total}</p>
            <p className="text-gray-400 text-xs">Games</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-900 rounded p-3 text-center">
            <p className="text-lg font-bold text-green-400">{profile.stats.wins}</p>
            <p className="text-gray-400 text-xs">Wins</p>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <p className="text-lg font-bold text-red-400">{profile.stats.losses}</p>
            <p className="text-gray-400 text-xs">Losses</p>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <p className="text-lg font-bold text-gray-300">{profile.stats.draws}</p>
            <p className="text-gray-400 text-xs">Draws</p>
          </div>
        </div>

        {streaks && isOwnProfile && (
          <StreakBadge current={streaks.current} bestWin={streaks.bestWin} />
        )}

        {/* Friend actions */}
        {!isOwnProfile && currentUser && (
          <div className="text-center">
            {friendState === "none" && (
              <button
                onClick={sendRequest}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium transition-colors"
              >
                Add Friend
              </button>
            )}
            {friendState === "pending" && (
              <span className="text-yellow-400 text-sm">Request Pending</span>
            )}
            {friendState === "incoming" && (
              <button
                onClick={acceptRequest}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium transition-colors"
              >
                Accept Request
              </button>
            )}
            {friendState === "friends" && (
              <button
                onClick={removeFriend}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-medium transition-colors"
              >
                Remove Friend
              </button>
            )}
          </div>
        )}

        {/* Recent games */}
        {profile.recentGames && profile.recentGames.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              {profile.isH2H ? "Games Between Us" : "Recent Games"}
            </h2>
            <div className="space-y-2">
              {profile.recentGames.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between bg-gray-800 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      {g.white?.username || "?"} vs {g.black?.username || "?"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.result || "—"} &middot; {g.timeControl} &middot;{" "}
                      {new Date(g.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => setFavoriteGameId(g.id)}
                      className="px-1.5 py-0.5 text-xs hover:text-red-400 transition-colors"
                      title="Add to collection"
                    >
                      ♡
                    </button>
                    <Link
                      href={`/game/${g.id}/analysis`}
                      className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    >
                      Analyze
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            &larr; Back
          </button>
        </div>
      </div>

      {/* Collection picker */}
      {favoriteGameId && (
        <CollectionPicker
          gameId={favoriteGameId}
          open={true}
          onClose={() => setFavoriteGameId(null)}
        />
      )}
    </main>
  );
}
