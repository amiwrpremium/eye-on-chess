import { describe, it, expect } from "vitest";
import {
  GAME_MODE_PRESETS,
  GAME_MODE_LABELS,
  DEFAULT_CUSTOM,
  type GameModeSettings,
} from "./gameModes";

describe("GAME_MODE_PRESETS", () => {
  it("has challenge, friendly, and assisted keys", () => {
    expect(Object.keys(GAME_MODE_PRESETS)).toEqual(
      expect.arrayContaining(["challenge", "friendly", "assisted"])
    );
    expect(Object.keys(GAME_MODE_PRESETS)).toHaveLength(3);
  });

  it("challenge preset has all features disabled", () => {
    const c = GAME_MODE_PRESETS.challenge;
    const allValues = Object.values(c) as boolean[];
    expect(allValues.every((v) => v === false)).toBe(true);
  });

  it("friendly preset has hints and takeback true, rest disabled", () => {
    const f = GAME_MODE_PRESETS.friendly;
    expect(f.hints).toBe(true);
    expect(f.takeback).toBe(true);
    expect(f.evalBar).toBe(false);
    expect(f.threats).toBe(false);
    expect(f.suggestions).toBe(false);
    expect(f.moveFeedback).toBe(false);
    expect(f.engine).toBe(false);
  });

  it("assisted preset has most features enabled", () => {
    const a = GAME_MODE_PRESETS.assisted;
    expect(a.hints).toBe(true);
    expect(a.evalBar).toBe(true);
    expect(a.threats).toBe(true);
    expect(a.suggestions).toBe(true);
    expect(a.moveFeedback).toBe(true);
    expect(a.engine).toBe(true);
    expect(a.takeback).toBe(false);
  });
});

describe("GAME_MODE_LABELS", () => {
  it("has all 4 keys: challenge, friendly, assisted, custom", () => {
    expect(Object.keys(GAME_MODE_LABELS)).toEqual(
      expect.arrayContaining(["challenge", "friendly", "assisted", "custom"])
    );
    expect(Object.keys(GAME_MODE_LABELS)).toHaveLength(4);
  });

  it("each label has name and desc strings", () => {
    for (const key of Object.keys(GAME_MODE_LABELS) as Array<keyof typeof GAME_MODE_LABELS>) {
      const label = GAME_MODE_LABELS[key];
      expect(typeof label.name).toBe("string");
      expect(typeof label.desc).toBe("string");
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_CUSTOM", () => {
  it("has expected default values", () => {
    expect(DEFAULT_CUSTOM).toEqual<GameModeSettings>({
      hints: true,
      evalBar: true,
      threats: false,
      suggestions: false,
      moveFeedback: true,
      takeback: false,
      engine: false,
    });
  });
});
