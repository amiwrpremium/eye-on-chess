"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";
import { useAuthStore } from "../../stores/auth";

interface Friend {
  friendshipId: string;
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
  isOnline: boolean;
}

interface FriendRequest {
  friendshipId: string;
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
  createdAt: string;
}

interface SearchUser {
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
}

export default function FriendsPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get("/api/friends"),
        api.get("/api/friends/requests"),
      ]);
      setFriends(friendsRes.data.friends);
      setRequests(requestsRes.data.requests);
    } catch {
      // Silently fail - user might not be authenticated yet
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.users);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function sendRequest(username: string) {
    try {
      await api.post("/api/friends/request", { username });
      setMessage(`Friend request sent to ${username}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to send request";
      setMessage(msg);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function acceptRequest(friendshipId: string) {
    try {
      await api.post("/api/friends/accept", { friendshipId });
      await loadData();
    } catch {
      setMessage("Failed to accept request");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function declineRequest(friendshipId: string) {
    try {
      await api.post("/api/friends/decline", { friendshipId });
      setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    } catch {
      setMessage("Failed to decline request");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function removeFriend(friendshipId: string) {
    try {
      await api.delete(`/api/friends/${friendshipId}`);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch {
      setMessage("Failed to remove friend");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-12">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">Friends</h1>

        {message && <p className="text-sm text-center text-yellow-400">{message}</p>}

        {/* Search */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Find Players</h2>
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
          />
          {searching && <p className="text-gray-400 text-sm mt-2">Searching...</p>}
          {searchResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between bg-gray-800 rounded p-2"
                >
                  <Link
                    href={`/profile/${u.username}`}
                    className="hover:text-blue-400 transition-colors"
                  >
                    <span className="font-medium">{u.username}</span>
                    <span className="text-gray-400 text-sm ml-2">({u.rating})</span>
                  </Link>
                  <button
                    onClick={() => sendRequest(u.username)}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Incoming Requests */}
        {requests.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Incoming Requests ({requests.length})</h2>
            <ul className="space-y-2">
              {requests.map((r) => (
                <li
                  key={r.friendshipId}
                  className="flex items-center justify-between bg-gray-800 rounded p-2"
                >
                  <Link
                    href={`/profile/${r.username}`}
                    className="hover:text-blue-400 transition-colors"
                  >
                    <span className="font-medium">{r.username}</span>
                    <span className="text-gray-400 text-sm ml-2">({r.rating})</span>
                  </Link>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(r.friendshipId)}
                      className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineRequest(r.friendshipId)}
                      className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Friends List */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">My Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-gray-400 text-sm">No friends yet. Search for players above!</p>
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li
                  key={f.friendshipId}
                  className="flex items-center justify-between bg-gray-800 rounded p-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        f.isOnline ? "bg-green-400" : "bg-gray-600"
                      }`}
                    />
                    <Link
                      href={`/profile/${f.username}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      <span className="font-medium">{f.username}</span>
                      <span className="text-gray-400 text-sm ml-2">({f.rating})</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => removeFriend(f.friendshipId)}
                    className="text-xs px-2 py-1 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-center">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Play
          </Link>
        </div>
      </div>
    </main>
  );
}
