import { describe, it, expect } from "vitest";
import { CLASSIFICATION_COLORS, CLASSIFICATION_SYMBOLS } from "./constants.js";

const ALL_CLASSIFICATIONS = [
  "BRILLIANT",
  "GREAT",
  "BEST",
  "EXCELLENT",
  "GOOD",
  "INACCURACY",
  "MISTAKE",
  "BLUNDER",
  "FORCED",
];

describe("CLASSIFICATION_COLORS", () => {
  it("has all 9 classification keys", () => {
    expect(Object.keys(CLASSIFICATION_COLORS)).toHaveLength(9);
    for (const key of ALL_CLASSIFICATIONS) {
      expect(CLASSIFICATION_COLORS).toHaveProperty(key);
    }
  });

  it("all values are Tailwind text color classes", () => {
    for (const value of Object.values(CLASSIFICATION_COLORS)) {
      expect(value).toMatch(/^text-/);
    }
  });

  it("has correct specific values", () => {
    expect(CLASSIFICATION_COLORS.BRILLIANT).toBe("text-cyan-400");
    expect(CLASSIFICATION_COLORS.BLUNDER).toBe("text-red-400");
    expect(CLASSIFICATION_COLORS.BEST).toBe("text-green-400");
    expect(CLASSIFICATION_COLORS.FORCED).toBe("text-gray-500");
  });
});

describe("CLASSIFICATION_SYMBOLS", () => {
  it("has all 9 classification keys", () => {
    expect(Object.keys(CLASSIFICATION_SYMBOLS)).toHaveLength(9);
    for (const key of ALL_CLASSIFICATIONS) {
      expect(CLASSIFICATION_SYMBOLS).toHaveProperty(key);
    }
  });

  it("BRILLIANT symbol is !!", () => {
    expect(CLASSIFICATION_SYMBOLS.BRILLIANT).toBe("!!");
  });

  it("BLUNDER symbol is ??", () => {
    expect(CLASSIFICATION_SYMBOLS.BLUNDER).toBe("??");
  });

  it("GREAT symbol is !", () => {
    expect(CLASSIFICATION_SYMBOLS.GREAT).toBe("!");
  });

  it("INACCURACY symbol is ?!", () => {
    expect(CLASSIFICATION_SYMBOLS.INACCURACY).toBe("?!");
  });

  it("MISTAKE symbol is ?", () => {
    expect(CLASSIFICATION_SYMBOLS.MISTAKE).toBe("?");
  });

  it("all values are non-empty strings", () => {
    for (const value of Object.values(CLASSIFICATION_SYMBOLS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
