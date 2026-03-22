"use client";

import { useState } from "react";
import api from "../lib/api";
import { useToast } from "./Toast";

interface ExportPGNProps {
  gameId: string;
  compact?: boolean; // small button for game cards
}

export default function ExportPGN({ gameId, compact = false }: ExportPGNProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function fetchPGN(): Promise<string | null> {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/games/${gameId}/pgn`, {
        responseType: "text",
        transformResponse: [(d: string) => d],
      });
      return data;
    } catch {
      toast.show("Failed to load PGN", "error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function copyPGN() {
    const pgn = await fetchPGN();
    if (!pgn) return;
    try {
      await navigator.clipboard.writeText(pgn);
      toast.show("PGN copied to clipboard");
    } catch {
      toast.show("Failed to copy", "error");
    }
    setShowMenu(false);
  }

  async function downloadPGN() {
    const pgn = await fetchPGN();
    if (!pgn) return;
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game_${gameId.slice(0, 8)}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  }

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={loading}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
        >
          {loading ? "..." : "PGN"}
        </button>
        {showMenu && (
          <div className="absolute bottom-full mb-1 right-0 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 min-w-[100px]">
            <button
              onClick={copyPGN}
              className="block w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors"
            >
              Copy
            </button>
            <button
              onClick={downloadPGN}
              className="block w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors"
            >
              Download
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm font-medium transition-colors"
      >
        {loading ? "Loading..." : "Export PGN"}
      </button>
      {showMenu && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded shadow-lg z-10">
          <button
            onClick={copyPGN}
            className="block w-full px-3 py-2 text-sm text-left hover:bg-gray-800 transition-colors"
          >
            Copy to clipboard
          </button>
          <button
            onClick={downloadPGN}
            className="block w-full px-3 py-2 text-sm text-left hover:bg-gray-800 transition-colors"
          >
            Download .pgn file
          </button>
        </div>
      )}
    </div>
  );
}
