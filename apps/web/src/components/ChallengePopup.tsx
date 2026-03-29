"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "../lib/socket";
import { useSound } from "../lib/useSound";
import api from "../lib/api";

interface Challenge {
  gameId: string;
  challenger: {
    id: string;
    username: string;
    rating: number;
  };
  timeControl: string;
  initialTime: number;
  increment: number;
}

function formatTime(seconds: number, increment: number): string {
  if (seconds === 0 && increment === 0) return "Unlimited";
  const min = Math.floor(seconds / 60);
  return increment > 0 ? `${min}+${increment}` : `${min}+0`;
}

/**
 * Renders a modal popup when an incoming game challenge is received via WebSocket.
 * Displays the challenger's username, rating, and time control, with accept/decline buttons.
 *
 * @returns The challenge modal, or null when no pending challenge exists.
 */
export default function ChallengePopup() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);

  const sound = useSound();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onChallenge(data: Challenge) {
      setChallenge(data);
      sound.playNotify();
    }

    socket.on("challenge:incoming", onChallenge);
    return () => {
      socket.off("challenge:incoming", onChallenge);
    };
  }, []);

  async function accept() {
    if (!challenge) return;
    setLoading(true);
    try {
      await api.post("/api/v1/games/challenge/accept", {
        gameId: challenge.gameId,
      });
      router.push(`/game/${challenge.gameId}`);
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }

  async function decline() {
    if (!challenge) return;
    setLoading(true);
    try {
      await api.post("/api/v1/games/challenge/decline", {
        gameId: challenge.gameId,
      });
    } catch {
      // ignore
    } finally {
      setChallenge(null);
      setLoading(false);
    }
  }

  if (!challenge) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="challenge-title" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onKeyDown={(e) => e.key === "Escape" && decline()}>
      <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4">
        <h2 id="challenge-title" className="text-lg font-bold mb-2 text-center">Challenge!</h2>
        <p className="text-gray-300 text-center mb-1">
          <span className="font-semibold">{challenge.challenger.username}</span>{" "}
          <span className="text-gray-400">({challenge.challenger.rating})</span>
        </p>
        <p className="text-gray-400 text-center text-sm mb-4">
          {formatTime(challenge.initialTime, challenge.increment)} &middot; {challenge.timeControl}
        </p>
        <div className="flex gap-3">
          <button
            onClick={decline}
            disabled={loading}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded font-medium transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            disabled={loading}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
