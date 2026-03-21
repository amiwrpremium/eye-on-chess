"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../stores/auth";
import { useSettingsStore, BoardTheme, PieceSet } from "../../stores/settings";

const BOARD_THEMES: { key: BoardTheme; label: string; preview: string }[] = [
  { key: "classic", label: "Classic", preview: "bg-[#b58863]" },
  { key: "wood", label: "Wood", preview: "bg-[#a67c52]" },
  { key: "green", label: "Green", preview: "bg-[#86a666]" },
  { key: "blue", label: "Blue", preview: "bg-[#8ca2ad]" },
  { key: "purple", label: "Purple", preview: "bg-[#9070b0]" },
  { key: "dark", label: "Dark", preview: "bg-[#302e2b]" },
];

const PIECE_SETS: { key: PieceSet; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "modern", label: "Modern" },
  { key: "minimal", label: "Minimal" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, fetchMe } = useAuthStore();
  const { darkMode, boardTheme, pieceSet, setDarkMode, setBoardTheme, setPieceSet } =
    useSettingsStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

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
        <h1 className="text-2xl font-bold text-center">Settings</h1>

        {/* Dark Mode */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Appearance</h2>
          <label className="flex items-center justify-between cursor-pointer">
            <span>Dark Mode</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                darkMode ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        {/* Board Theme */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Board Theme</h2>
          <div className="grid grid-cols-3 gap-2">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setBoardTheme(t.key)}
                className={`p-3 rounded border-2 transition-colors ${
                  boardTheme === t.key
                    ? "border-blue-500"
                    : "border-transparent hover:border-gray-600"
                }`}
              >
                <div className={`w-full h-8 rounded ${t.preview} mb-1`} />
                <span className="text-xs">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Piece Set */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Piece Set</h2>
          <div className="grid grid-cols-3 gap-2">
            {PIECE_SETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPieceSet(p.key)}
                className={`py-2 px-3 rounded border-2 text-sm transition-colors ${
                  pieceSet === p.key
                    ? "border-blue-500 bg-gray-800"
                    : "border-transparent hover:border-gray-600 bg-gray-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
