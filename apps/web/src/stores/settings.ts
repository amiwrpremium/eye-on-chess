import { create } from "zustand";
import api from "../lib/api";
import { useToast } from "@eyeonchess/ui";

export type BoardTheme = "classic" | "wood" | "green" | "blue" | "purple" | "dark";
export type PieceSet = "classic" | "modern" | "minimal";

/** Shape of the settings Zustand store, including UI preferences and their setters. */
interface SettingsState {
  darkMode: boolean;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  soundEnabled: boolean;
  setDarkMode: (dark: boolean) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setPieceSet: (set: PieceSet) => void;
  setSoundEnabled: (enabled: boolean) => void;
  loadFromUser: (prefs: {
    darkMode: boolean;
    boardTheme: string;
    pieceSet: string;
    soundEnabled?: boolean;
  }) => void;
}

async function savePreference(data: Record<string, unknown>) {
  try {
    await api.put("/api/v1/auth/preferences", data);
    useToast.getState().show("Settings saved", "success");
  } catch {
    // Silently fail — will sync next login
  }
}

/**
 * Zustand store for user UI preferences (dark mode, board theme, piece set, sound).
 * Each setter persists the change to the server via the preferences API.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: true,
  boardTheme: "classic",
  pieceSet: "classic",
  soundEnabled: true,

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

  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    savePreference({ soundEnabled });
  },

  loadFromUser: (prefs) => {
    set({
      darkMode: prefs.darkMode,
      boardTheme: prefs.boardTheme as BoardTheme,
      pieceSet: prefs.pieceSet as PieceSet,
      soundEnabled: prefs.soundEnabled ?? true,
    });
  },
}));
