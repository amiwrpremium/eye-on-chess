import { describe, it, expect } from "vitest";
import { categorizeTimeControl, TIME_CONTROL_PRESETS } from "./constants";

describe("categorizeTimeControl", () => {
  it("returns UNLIMITED for 0+0", () => {
    expect(categorizeTimeControl(0, 0)).toBe("UNLIMITED");
  });

  it("returns BULLET for 60+0 (total 60 < 180)", () => {
    expect(categorizeTimeControl(60, 0)).toBe("BULLET");
  });

  it("returns BULLET for 120+1 (total 120+40 = 160 < 180)", () => {
    expect(categorizeTimeControl(120, 1)).toBe("BULLET");
  });

  it("returns BLITZ for 180+0 (total 180, boundary: >= 180 and < 480)", () => {
    expect(categorizeTimeControl(180, 0)).toBe("BLITZ");
  });

  it("returns BLITZ for 300+3 (total 300+120 = 420 < 480)", () => {
    expect(categorizeTimeControl(300, 3)).toBe("BLITZ");
  });

  it("returns RAPID for 600+0 (total 600, >= 480 and < 1500)", () => {
    expect(categorizeTimeControl(600, 0)).toBe("RAPID");
  });

  it("returns RAPID for 900+10 (total 900+400 = 1300 < 1500)", () => {
    expect(categorizeTimeControl(900, 10)).toBe("RAPID");
  });

  it("returns CLASSICAL for 1800+0 (total 1800 >= 1500)", () => {
    expect(categorizeTimeControl(1800, 0)).toBe("CLASSICAL");
  });

  it("returns CLASSICAL for 900+15 (total 900+600 = 1500, boundary)", () => {
    expect(categorizeTimeControl(900, 15)).toBe("CLASSICAL");
  });

  it("returns BLITZ at boundary 179+0 is BULLET (179 < 180)", () => {
    expect(categorizeTimeControl(179, 0)).toBe("BULLET");
  });

  it("returns RAPID at boundary 479+0 is BLITZ (479 < 480)", () => {
    expect(categorizeTimeControl(479, 0)).toBe("BLITZ");
  });

  it("returns RAPID for 480+0 (480 >= 480)", () => {
    expect(categorizeTimeControl(480, 0)).toBe("RAPID");
  });

  it("returns CLASSICAL at boundary 1499+0 is RAPID (1499 < 1500)", () => {
    expect(categorizeTimeControl(1499, 0)).toBe("RAPID");
  });

  it("returns CLASSICAL for 1500+0 (1500 >= 1500)", () => {
    expect(categorizeTimeControl(1500, 0)).toBe("CLASSICAL");
  });
});

describe("TIME_CONTROL_PRESETS", () => {
  const expectedKeys = [
    "bullet_1_0",
    "bullet_1_1",
    "bullet_2_0",
    "bullet_2_1",
    "blitz_3_0",
    "blitz_3_2",
    "blitz_5_0",
    "blitz_5_3",
    "blitz_5_5",
    "rapid_10_0",
    "rapid_10_5",
    "rapid_15_10",
    "rapid_20_0",
    "classical_30_0",
    "classical_30_20",
    "classical_45_15",
    "classical_60_0",
    "unlimited",
  ];

  it("has all expected preset keys", () => {
    for (const key of expectedKeys) {
      expect(TIME_CONTROL_PRESETS).toHaveProperty(key);
    }
  });

  it("has the correct number of presets", () => {
    expect(Object.keys(TIME_CONTROL_PRESETS)).toHaveLength(expectedKeys.length);
  });

  it("each preset has label, timeControl, initialTime, and increment", () => {
    for (const [_key, preset] of Object.entries(TIME_CONTROL_PRESETS)) {
      expect(preset).toHaveProperty("label");
      expect(preset).toHaveProperty("timeControl");
      expect(preset).toHaveProperty("initialTime");
      expect(preset).toHaveProperty("increment");
      expect(typeof preset.label).toBe("string");
      expect(typeof preset.timeControl).toBe("string");
      expect(typeof preset.initialTime).toBe("number");
      expect(typeof preset.increment).toBe("number");
    }
  });

  it("each preset timeControl matches categorizeTimeControl result", () => {
    for (const [_key, preset] of Object.entries(TIME_CONTROL_PRESETS)) {
      const computed = categorizeTimeControl(preset.initialTime, preset.increment);
      expect(computed).toBe(preset.timeControl);
    }
  });

  it("bullet_1_0 has correct values", () => {
    const preset = TIME_CONTROL_PRESETS.bullet_1_0;
    expect(preset.label).toBe("1+0");
    expect(preset.timeControl).toBe("BULLET");
    expect(preset.initialTime).toBe(60);
    expect(preset.increment).toBe(0);
  });

  it("blitz_5_0 has correct values", () => {
    const preset = TIME_CONTROL_PRESETS.blitz_5_0;
    expect(preset.label).toBe("5+0");
    expect(preset.timeControl).toBe("BLITZ");
    expect(preset.initialTime).toBe(300);
    expect(preset.increment).toBe(0);
  });

  it("rapid_10_0 has correct values", () => {
    const preset = TIME_CONTROL_PRESETS.rapid_10_0;
    expect(preset.label).toBe("10+0");
    expect(preset.timeControl).toBe("RAPID");
    expect(preset.initialTime).toBe(600);
    expect(preset.increment).toBe(0);
  });

  it("unlimited has correct values", () => {
    const preset = TIME_CONTROL_PRESETS.unlimited;
    expect(preset.label).toBe("Unlimited");
    expect(preset.timeControl).toBe("UNLIMITED");
    expect(preset.initialTime).toBe(0);
    expect(preset.increment).toBe(0);
  });
});
