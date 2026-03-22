import { describe, it, expect } from "vitest";
import { REACTIONS, VALID_REACTIONS } from "./constants";

const ALL_REACTION_KEYS = ["good_move", "brilliant", "blunder", "thinking", "gg", "takeback"];

describe("REACTIONS", () => {
  it("has 6 reaction keys", () => {
    expect(Object.keys(REACTIONS)).toHaveLength(6);
  });

  it("has all expected keys", () => {
    for (const key of ALL_REACTION_KEYS) {
      expect(REACTIONS).toHaveProperty(key);
    }
  });

  it("each reaction has emoji, label, and color properties", () => {
    for (const [_key, reaction] of Object.entries(REACTIONS)) {
      expect(reaction).toHaveProperty("emoji");
      expect(reaction).toHaveProperty("label");
      expect(reaction).toHaveProperty("color");
      expect(typeof reaction.emoji).toBe("string");
      expect(typeof reaction.label).toBe("string");
      expect(typeof reaction.color).toBe("string");
    }
  });

  it("gg reaction has label GG", () => {
    expect(REACTIONS.gg.label).toBe("GG");
  });

  it("brilliant reaction has label Brilliant!", () => {
    expect(REACTIONS.brilliant.label).toBe("Brilliant!");
  });

  it("blunder reaction has label Blunder!", () => {
    expect(REACTIONS.blunder.label).toBe("Blunder!");
  });

  it("all color values are Tailwind text color classes", () => {
    for (const reaction of Object.values(REACTIONS)) {
      expect(reaction.color).toMatch(/^text-/);
    }
  });

  it("all emoji values are non-empty", () => {
    for (const reaction of Object.values(REACTIONS)) {
      expect(reaction.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("VALID_REACTIONS", () => {
  it("has 6 entries", () => {
    expect(VALID_REACTIONS).toHaveLength(6);
  });

  it("matches REACTIONS keys", () => {
    const reactionKeys = Object.keys(REACTIONS);
    expect(VALID_REACTIONS).toEqual(expect.arrayContaining(reactionKeys));
    expect(reactionKeys).toEqual(expect.arrayContaining([...VALID_REACTIONS]));
  });

  it("contains all expected reaction types", () => {
    for (const key of ALL_REACTION_KEYS) {
      expect(VALID_REACTIONS).toContain(key);
    }
  });
});
