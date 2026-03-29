"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { connectSocket, getSocket } from "../../../lib/socket";
import { ConfirmModal, useToast } from "@eyeonchess/ui";
import { loadFriendPrefs, saveFriendPrefs } from "../../../lib/gamePrefs";
import TimeControlPicker from "../../../components/TimeControlPicker";
import { TIME_CONTROL_PRESETS } from "@eyeonchess/chess";

interface Friend {
  friendshipId: string;
  id: string;
  username: string;
  rating: number;
  isOnline: boolean;
}

export default function ChallengeFriendPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [customIncrement, setCustomIncrement] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmChallenge, setConfirmChallenge] = useState<string | null>(null); // preset or "custom"

  // Restore last-used time settings from localStorage
  useEffect(() => {
    const prefs = loadFriendPrefs();
    setShowCustom(prefs.showCustom);
    setCustomMinutes(prefs.customMinutes);
    setCustomIncrement(prefs.customIncrement);
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) connectSocket();
  }, [user]);

  const loadFriends = useCallback(async () => {
    try {
      const { data } = await api.get("/api/v1/friends");
      setFriends(data.friends);
    } catch {
      toast.show("Failed to load friends", "error");
    }
  }, []);

  useEffect(() => {
    if (user) loadFriends();
  }, [user, loadFriends]);

  // Listen for challenge accepted → navigate to game
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onAccepted(data: { gameId: string }) {
      router.push(`/game/${data.gameId}`);
    }

    function onDeclined() {
      setMessage("Challenge declined");
      setSending(false);
      setTimeout(() => setMessage(""), 3000);
    }

    socket.on("challenge:accepted", onAccepted);
    socket.on("challenge:declined", onDeclined);
    return () => {
      socket.off("challenge:accepted", onAccepted);
      socket.off("challenge:declined", onDeclined);
    };
  }, [router]);

  async function sendChallenge(preset?: string) {
    if (!selectedFriend) return;
    setSending(true);
    setMessage("");

    saveFriendPrefs({
      lastTimeControl: preset || "custom",
      showCustom,
      customMinutes,
      customIncrement,
    });

    try {
      const body: Record<string, unknown> = { friendId: selectedFriend.id };
      if (preset) {
        body.preset = preset;
      } else {
        body.initialTime = customMinutes * 60;
        body.increment = customIncrement;
      }
      await api.post("/api/v1/games/friend", body);
      setMessage(`Challenge sent to ${selectedFriend.username}! Waiting...`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to send challenge";
      setMessage(msg);
      setSending(false);
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const onlineFriends = friends.filter((f) => f.isOnline);
  const offlineFriends = friends.filter((f) => !f.isOnline);

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-12">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">Challenge a Friend</h1>

        {message && <p className="text-sm text-center text-yellow-400">{message}</p>}

        {/* Friend selection */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Select Opponent</h2>
          {friends.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No friends yet.{" "}
              <Link href="/friends" className="text-blue-400 hover:underline">
                Add some!
              </Link>
            </p>
          ) : (
            <div className="space-y-1.5">
              {[...onlineFriends, ...offlineFriends].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFriend(f)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
                    selectedFriend?.id === f.id ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      f.isOnline ? "bg-green-400" : "bg-gray-600"
                    }`}
                  />
                  <span className="font-medium">{f.username}</span>
                  <span className="text-gray-400 text-sm">({f.rating})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time control */}
        {selectedFriend && (
          <TimeControlPicker
            selectedTime={null}
            showCustomTime={showCustom}
            customMinutes={customMinutes}
            customIncrement={customIncrement}
            onSelect={(key) => setConfirmChallenge(key)}
            onSelectCustom={() => setConfirmChallenge("custom")}
            onCustomMinutesChange={setCustomMinutes}
            onCustomIncrementChange={setCustomIncrement}
            disabled={sending}
          />
        )}

        <div className="text-center">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Play
          </Link>
        </div>

        <ConfirmModal
          open={!!confirmChallenge}
          title="Send Challenge?"
          message={`Challenge ${selectedFriend?.username || "friend"} (${selectedFriend?.rating || "?"})\nTime: ${confirmChallenge === "custom" ? `${customMinutes}+${customIncrement}` : (confirmChallenge && TIME_CONTROL_PRESETS[confirmChallenge]?.label) || confirmChallenge || ""}`}
          confirmLabel="Send Challenge"
          confirmVariant="primary"
          onConfirm={() => {
            const preset = confirmChallenge;
            setConfirmChallenge(null);
            if (preset === "custom") sendChallenge();
            else sendChallenge(preset || undefined);
          }}
          onCancel={() => setConfirmChallenge(null)}
        />
      </div>
    </main>
  );
}
