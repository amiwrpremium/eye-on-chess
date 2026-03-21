import { describe, it, expect } from "vitest";
import { lookupOpening } from "./eco.js";

describe("lookupOpening", () => {
  it("should find Sicilian Defense", () => {
    const result = lookupOpening(["e4", "c5"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sicilian Defense");
    expect(result!.eco).toBe("B20");
  });

  it("should find Italian Game", () => {
    const result = lookupOpening(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Italian Game");
  });

  it("should find Ruy Lopez", () => {
    const result = lookupOpening(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Ruy Lopez");
  });

  it("should find Queen's Gambit Declined", () => {
    const result = lookupOpening(["d4", "d5", "c4", "e6"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Queen's Gambit Declined");
  });

  it("should find French Defense", () => {
    const result = lookupOpening(["e4", "e6"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("French Defense");
  });

  it("should use longest prefix match", () => {
    // Sicilian Najdorf is more specific than Open Sicilian
    const result = lookupOpening([
      "e4",
      "c5",
      "Nf3",
      "d6",
      "d4",
      "cxd4",
      "Nxd4",
      "Nf6",
      "Nc3",
      "a6",
    ]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sicilian Najdorf");
  });

  it("should match even with extra moves after the opening", () => {
    const result = lookupOpening(["e4", "c5", "Nf3", "d6", "Bb5+"]);
    expect(result).not.toBeNull();
    // Should match at least "Sicilian Defense: Old Sicilian" or a Sicilian variant
  });

  it("should return null for unknown opening", () => {
    const result = lookupOpening(["a4", "a5", "b4"]);
    expect(result).toBeNull();
  });

  it("should return null for empty moves", () => {
    const result = lookupOpening([]);
    expect(result).toBeNull();
  });

  it("should find English Opening", () => {
    const result = lookupOpening(["c4"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("English Opening");
  });

  it("should find King's Indian Defense", () => {
    const result = lookupOpening(["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("King's Indian Defense");
  });

  it("should find Caro-Kann Defense", () => {
    const result = lookupOpening(["e4", "c6"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Caro-Kann Defense");
  });

  it("should find London System", () => {
    const result = lookupOpening(["d4", "d5", "Bf4"]);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("London System");
  });
});
