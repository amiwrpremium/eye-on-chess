import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the API module
vi.mock("../lib/api", () => ({
  default: {
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { useSettingsStore } from "./settings";

describe("useSettingsStore", () => {
  beforeEach(() => {
    // Reset store to defaults
    useSettingsStore.setState({
      darkMode: true,
      boardTheme: "classic",
      pieceSet: "classic",
    });
  });

  it("should have correct defaults", () => {
    const state = useSettingsStore.getState();
    expect(state.darkMode).toBe(true);
    expect(state.boardTheme).toBe("classic");
    expect(state.pieceSet).toBe("classic");
  });

  it("should set dark mode", () => {
    useSettingsStore.getState().setDarkMode(false);
    expect(useSettingsStore.getState().darkMode).toBe(false);
  });

  it("should set board theme", () => {
    useSettingsStore.getState().setBoardTheme("green");
    expect(useSettingsStore.getState().boardTheme).toBe("green");
  });

  it("should set piece set", () => {
    useSettingsStore.getState().setPieceSet("modern");
    expect(useSettingsStore.getState().pieceSet).toBe("modern");
  });

  it("should load from user preferences", () => {
    useSettingsStore.getState().loadFromUser({
      darkMode: false,
      boardTheme: "blue",
      pieceSet: "minimal",
    });
    const state = useSettingsStore.getState();
    expect(state.darkMode).toBe(false);
    expect(state.boardTheme).toBe("blue");
    expect(state.pieceSet).toBe("minimal");
  });

  it("should accept all valid board themes", () => {
    const themes = ["classic", "wood", "green", "blue", "purple", "dark"] as const;
    for (const theme of themes) {
      useSettingsStore.getState().setBoardTheme(theme);
      expect(useSettingsStore.getState().boardTheme).toBe(theme);
    }
  });

  it("should accept all valid piece sets", () => {
    const sets = ["classic", "modern", "minimal"] as const;
    for (const set of sets) {
      useSettingsStore.getState().setPieceSet(set);
      expect(useSettingsStore.getState().pieceSet).toBe(set);
    }
  });
});
