"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";

interface UserProfile {
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
  createdAt: string;
  stats: { wins: number; losses: number; draws: number; total: number };
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

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/users/${username}`);
        setProfile(data.user);

        // Check friendship status if logged in
        if (currentUser && data.user.id !== currentUser.id) {
          const [friendsRes, requestsRes] = await Promise.all([
            api.get("/api/friends"),
            api.get("/api/friends/requests"),
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

          // Could also be outgoing pending — we just show "pending" state
          // For simplicity, we'll set none and let the server reject duplicates
          setFriendState("none");
        }
      } catch {
        setError("User not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, currentUser]);

  async function sendRequest() {
    setActionLoading(true);
    try {
      await api.post("/api/friends/request", { username });
      setFriendState("pending");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to send request";
      // If already pending, show that state
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
      await api.post("/api/friends/accept", { friendshipId });
      setFriendState("friends");
    } catch {
      setError("Failed to accept request");
    } finally {
      setActionLoading(false);
    }
  }

  async function removeFriend() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/friends/${friendshipId}`);
      setFriendState("none");
      setFriendshipId(null);
    } catch {
      setError("Failed to remove friend");
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

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
            {profile.username[0].toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{profile.username}</h1>
          <p className="text-gray-400 text-sm">
            Joined {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded p-3 text-center">
            <p className="text-2xl font-bold">{profile.rating}</p>
            <p className="text-gray-400 text-xs">Rating</p>
          </div>
          <div className="bg-gray-800 rounded p-3 text-center">
            <p className="text-2xl font-bold">{profile.stats.total}</p>
            <p className="text-gray-400 text-xs">Games</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-800 rounded p-3 text-center">
            <p className="text-lg font-bold text-green-400">{profile.stats.wins}</p>
            <p className="text-gray-400 text-xs">Wins</p>
          </div>
          <div className="bg-gray-800 rounded p-3 text-center">
            <p className="text-lg font-bold text-red-400">{profile.stats.losses}</p>
            <p className="text-gray-400 text-xs">Losses</p>
          </div>
          <div className="bg-gray-800 rounded p-3 text-center">
            <p className="text-lg font-bold text-gray-300">{profile.stats.draws}</p>
            <p className="text-gray-400 text-xs">Draws</p>
          </div>
        </div>

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

        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            &larr; Back
          </button>
        </div>
      </div>
    </main>
  );
}
