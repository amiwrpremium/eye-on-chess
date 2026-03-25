import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBotReactions } from "./useBotReactions";
import type { BotPersonality } from "@eyeonchess/chess";

// No crypto mock needed - useBotReactions uses Math.random() for IDs

const AMIR: BotPersonality = {
  id: "amir",
  name: "Amir",
  elo: 200,
  description: "Test",
  avatar: "T",
  tier: "custom",
  category: "beginner",
  randomMoveChance: 0.45,
  blunderChance: 0.3,
  captureGreed: 0.9,
  aggressionBias: 0,
  maxDepth: 1,
  queenEarly: false,
  pawnPusher: true,
};

const _ERFAN: BotPersonality = {
  id: "erfan",
  name: "Erfan",
  elo: 3200,
  description: "Test",
  avatar: "T",
  tier: "engine",
  category: "grandmaster",
  randomMoveChance: 0,
  blunderChance: 0,
  captureGreed: 0.35,
  aggressionBias: 0,
  maxDepth: 18,
  queenEarly: false,
  pawnPusher: false,
};

describe("useBotReactions", () => {
  beforeEach(() => {
    uuidCounter = 0;
    vi.spyOn(Math, "random").mockRestore();
  });

  it("returns empty array initially", () => {
    const { result } = renderHook(() => useBotReactions());
    expect(result.current.activeReactions).toEqual([]);
  });

  it("adds reaction when probability passes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // always passes probability
    const { result } = renderHook(() => useBotReactions());
    act(() => result.current.triggerReaction("gameEnd", AMIR));
    expect(result.current.activeReactions).toHaveLength(1);
    expect(result.current.activeReactions[0].reaction).toBe("gg");
    expect(result.current.activeReactions[0].fromOpponent).toBe(true);
  });

  it("skips reaction when probability fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // fails most probabilities
    const { result } = renderHook(() => useBotReactions());
    act(() => result.current.triggerReaction("playerGoodMove", AMIR)); // 0.15 probability
    expect(result.current.activeReactions).toHaveLength(0);
  });

  it("removeReaction removes by id", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useBotReactions());
    act(() => result.current.triggerReaction("gameEnd", AMIR));
    expect(result.current.activeReactions).toHaveLength(1);
    const id = result.current.activeReactions[0].id;
    act(() => result.current.removeReaction(id));
    expect(result.current.activeReactions).toHaveLength(0);
  });

  it("clearReactions empties array", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useBotReactions());
    act(() => result.current.triggerReaction("gameEnd", AMIR));
    expect(result.current.activeReactions).toHaveLength(1);
    act(() => result.current.clearReactions());
    expect(result.current.activeReactions).toHaveLength(0);
  });

  it("caps at 5 active reactions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useBotReactions());
    // gameEnd bypasses cooldown, so we can spam it
    for (let i = 0; i < 8; i++) {
      act(() => result.current.triggerReaction("gameEnd", AMIR));
    }
    expect(result.current.activeReactions.length).toBeLessThanOrEqual(5);
  });

  it("high captureGreed bots react to captures with brilliant", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // passes probability
    const { result } = renderHook(() => useBotReactions());
    act(() => result.current.triggerReaction("botCapture", AMIR)); // captureGreed 0.9
    expect(result.current.activeReactions).toHaveLength(1);
    expect(result.current.activeReactions[0].reaction).toBe("brilliant");
  });
});
