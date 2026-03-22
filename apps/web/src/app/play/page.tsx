"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../stores/auth";
import { connectSocket, disconnectSocket } from "../../lib/socket";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useInstallPrompt } from "../../lib/useInstallPrompt";
import ActivityFeed from "../../components/ActivityFeed";
import ChallengePopup from "../../components/ChallengePopup";

export default function PlayPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe, logout } = useAuthStore();
  const isOnline = useOnlineStatus();
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  // Connect socket when authenticated
  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [user]);

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Play</h1>
        <p className="text-gray-300 mb-2">
          Welcome, <span className="font-semibold">{user.username}</span>
        </p>
        <p className="text-gray-400 text-sm mb-6">
          Rating: {user.rating} &middot; {user.email}
        </p>
        <div className="flex flex-col gap-3 mb-6">
          <Link
            href="/play/bot"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
          >
            Play vs Bot
            {!isOnline && <span className="text-xs text-green-300 ml-1">(offline)</span>}
          </Link>
          <Link
            href="/play/friend"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
          >
            Challenge a Friend
          </Link>
          <Link
            href="/history"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            Game History
          </Link>
          <Link
            href="/collections"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            Collections
          </Link>
          <Link
            href={`/profile/${user.username}`}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            My Profile
          </Link>
          <Link
            href="/invites"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            Invites
          </Link>
          <Link
            href="/friends"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            Friends
          </Link>
          <Link
            href="/settings"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
          >
            Settings
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors"
            >
              Admin Panel
            </Link>
          )}
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium transition-colors"
        >
          Log Out
        </button>

        {/* Activity feed */}
        <ActivityFeed />

        {/* Online indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-xs text-gray-500">{isOnline ? "Online" : "Offline"}</span>
        </div>

        {/* Install PWA */}
        {canInstall && (
          <button
            onClick={install}
            className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium text-sm transition-colors"
          >
            Install App
          </button>
        )}
      </div>
      <ChallengePopup />
    </main>
  );
}
