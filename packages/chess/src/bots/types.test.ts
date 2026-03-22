import { describe, it, expect } from "vitest";
import { getEloBand, ELO_BAND_COLORS } from "./types";
import type { EloBand } from "./types";

describe("getEloBand", () => {
  it("returns 'red' for elo <= 600", () => {
    expect(getEloBand(200)).toBe("red");
    expect(getEloBand(600)).toBe("red");
  });

  it("returns 'orange' for elo 601-1000", () => {
    expect(getEloBand(601)).toBe("orange");
    expect(getEloBand(1000)).toBe("orange");
  });

  it("returns 'yellow' for elo 1001-1400", () => {
    expect(getEloBand(1001)).toBe("yellow");
    expect(getEloBand(1400)).toBe("yellow");
  });

  it("returns 'green' for elo 1401-1800", () => {
    expect(getEloBand(1401)).toBe("green");
    expect(getEloBand(1800)).toBe("green");
  });

  it("returns 'blue' for elo 1801-2200", () => {
    expect(getEloBand(1801)).toBe("blue");
    expect(getEloBand(2200)).toBe("blue");
  });

  it("returns 'purple' for elo 2201-2600", () => {
    expect(getEloBand(2201)).toBe("purple");
    expect(getEloBand(2600)).toBe("purple");
  });

  it("returns 'gold' for elo > 2600", () => {
    expect(getEloBand(2601)).toBe("gold");
    expect(getEloBand(3200)).toBe("gold");
  });
});

describe("ELO_BAND_COLORS", () => {
  const allBands: EloBand[] = ["red", "orange", "yellow", "green", "blue", "purple", "gold"];

  it("has all 7 bands", () => {
    expect(Object.keys(ELO_BAND_COLORS)).toHaveLength(7);
    for (const band of allBands) {
      expect(ELO_BAND_COLORS[band]).toBeDefined();
    }
  });

  it("each band has bg, text, ring properties", () => {
    for (const band of allBands) {
      const colors = ELO_BAND_COLORS[band];
      expect(colors).toHaveProperty("bg");
      expect(colors).toHaveProperty("text");
      expect(colors).toHaveProperty("ring");
      expect(typeof colors.bg).toBe("string");
      expect(typeof colors.text).toBe("string");
      expect(typeof colors.ring).toBe("string");
    }
  });
});
