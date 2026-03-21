import { create } from "zustand";
import api from "../lib/api";

export type BoardTheme = "classic" | "wood" | "green" | "blue" | "purple" | "dark";
export type PieceSet = "classic" | "modern" | "minimal";

interface SettingsState {
  darkMode: boolean;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  setDarkMode: (dark: boolean) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setPieceSet: (set: PieceSet) => void;
  loadFromUser: (prefs: { darkMode: boolean; boardTheme: string; pieceSet: string }) => void;
}

async function savePreference(data: Record<string, unknown>) {
  try {
    await api.put("/api/auth/preferences", data);
  } catch {
    // Silently fail — will sync next login
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: true,
  boardTheme: "classic",
  pieceSet: "classic",

  setDarkMode: (dark) => {
    set({ darkMode: dark });
    savePreference({ darkMode: dark });
  },

  setBoardTheme: (theme) => {
    set({ boardTheme: theme });
    savePreference({ boardTheme: theme });
  },

  setPieceSet: (pieceSet) => {
    set({ pieceSet });
    savePreference({ pieceSet });
  },

  loadFromUser: (prefs) => {
    set({
      darkMode: prefs.darkMode,
      boardTheme: prefs.boardTheme as BoardTheme,
      pieceSet: prefs.pieceSet as PieceSet,
    });
  },
}));
