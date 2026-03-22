import { describe, it, expect } from "vitest";
import { BOT_PERSONALITIES, getBotById, getAllBots } from "./personalities";

describe("BOT_PERSONALITIES", () => {
  it("contains exactly 31 bots", () => {
    expect(BOT_PERSONALITIES).toHaveLength(31);
  });

  it("has all unique IDs", () => {
    const ids = BOT_PERSONALITIES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has all elos in range 200-3200", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.elo).toBeGreaterThanOrEqual(200);
      expect(bot.elo).toBeLessThanOrEqual(3200);
    }
  });

  it("is sorted by elo ascending", () => {
    for (let i = 1; i < BOT_PERSONALITIES.length; i++) {
      expect(BOT_PERSONALITIES[i].elo).toBeGreaterThanOrEqual(BOT_PERSONALITIES[i - 1].elo);
    }
  });

  it("has 'amir' as the first bot with elo 200", () => {
    const first = BOT_PERSONALITIES[0];
    expect(first.id).toBe("amir");
    expect(first.elo).toBe(200);
  });

  it("has 'erfan' as the last bot with elo 3200", () => {
    const last = BOT_PERSONALITIES[BOT_PERSONALITIES.length - 1];
    expect(last.id).toBe("erfan");
    expect(last.elo).toBe(3200);
  });

  it("has all valid tiers", () => {
    const validTiers = new Set(["custom", "hybrid", "engine"]);
    for (const bot of BOT_PERSONALITIES) {
      expect(validTiers.has(bot.tier)).toBe(true);
    }
  });

  it("custom tier bots have elo <= 1200", () => {
    const customBots = BOT_PERSONALITIES.filter((b) => b.tier === "custom");
    for (const bot of customBots) {
      expect(bot.elo).toBeLessThanOrEqual(1200);
    }
  });

  it("hybrid tier bots have elo 1300-1900", () => {
    const hybridBots = BOT_PERSONALITIES.filter((b) => b.tier === "hybrid");
    for (const bot of hybridBots) {
      expect(bot.elo).toBeGreaterThanOrEqual(1300);
      expect(bot.elo).toBeLessThanOrEqual(1900);
    }
  });

  it("engine tier bots have elo >= 2000", () => {
    const engineBots = BOT_PERSONALITIES.filter((b) => b.tier === "engine");
    for (const bot of engineBots) {
      expect(bot.elo).toBeGreaterThanOrEqual(2000);
    }
  });

  it("all randomMoveChance values are 0-0.5", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.randomMoveChance).toBeGreaterThanOrEqual(0);
      expect(bot.randomMoveChance).toBeLessThanOrEqual(0.5);
    }
  });

  it("all blunderChance values are 0-0.3", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.blunderChance).toBeGreaterThanOrEqual(0);
      expect(bot.blunderChance).toBeLessThanOrEqual(0.3);
    }
  });

  it("all captureGreed values are 0-1", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.captureGreed).toBeGreaterThanOrEqual(0);
      expect(bot.captureGreed).toBeLessThanOrEqual(1);
    }
  });

  it("all aggressionBias values are -1 to 1", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.aggressionBias).toBeGreaterThanOrEqual(-1);
      expect(bot.aggressionBias).toBeLessThanOrEqual(1);
    }
  });

  it("all maxDepth values are 1-18", () => {
    for (const bot of BOT_PERSONALITIES) {
      expect(bot.maxDepth).toBeGreaterThanOrEqual(1);
      expect(bot.maxDepth).toBeLessThanOrEqual(18);
    }
  });
});

describe("getBotById", () => {
  it("returns the correct bot for a known id", () => {
    const bot = getBotById("amir");
    expect(bot).toBeDefined();
    expect(bot!.id).toBe("amir");
    expect(bot!.name).toBe("Amir");
    expect(bot!.elo).toBe(200);
  });

  it("returns undefined for an unknown id", () => {
    expect(getBotById("nonexistent")).toBeUndefined();
  });
});

describe("getAllBots", () => {
  it("returns 31 bots", () => {
    expect(getAllBots()).toHaveLength(31);
  });
});
