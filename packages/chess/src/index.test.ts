import { describe, it, expect } from "vitest";
import {
  // Game constants
  RESULT_PGN,
  RESULT_LABELS,
  TERMINATION_LABELS,
  // Game helpers
  didPlayerWin,
  didPlayerLose,
  isDrawResult,
  // Time control
  TIME_CONTROL_PRESETS,
  categorizeTimeControl,
  // Moves
  CLASSIFICATION_COLORS,
  CLASSIFICATION_SYMBOLS,
  // Openings
  ECO_DATABASE,
  lookupOpening,
  // Reactions
  REACTIONS,
  VALID_REACTIONS,
} from "./index.js";

describe("barrel exports: game", () => {
  it("exports RESULT_PGN as an object", () => {
    expect(RESULT_PGN).toBeDefined();
    expect(typeof RESULT_PGN).toBe("object");
  });

  it("exports RESULT_LABELS as an object", () => {
    expect(RESULT_LABELS).toBeDefined();
    expect(typeof RESULT_LABELS).toBe("object");
  });

  it("exports TERMINATION_LABELS as an object", () => {
    expect(TERMINATION_LABELS).toBeDefined();
    expect(typeof TERMINATION_LABELS).toBe("object");
  });

  it("exports didPlayerWin as a function", () => {
    expect(typeof didPlayerWin).toBe("function");
  });

  it("exports didPlayerLose as a function", () => {
    expect(typeof didPlayerLose).toBe("function");
  });

  it("exports isDrawResult as a function", () => {
    expect(typeof isDrawResult).toBe("function");
  });
});

describe("barrel exports: time control", () => {
  it("exports TIME_CONTROL_PRESETS as an object", () => {
    expect(TIME_CONTROL_PRESETS).toBeDefined();
    expect(typeof TIME_CONTROL_PRESETS).toBe("object");
  });

  it("exports categorizeTimeControl as a function", () => {
    expect(typeof categorizeTimeControl).toBe("function");
  });
});

describe("barrel exports: moves", () => {
  it("exports CLASSIFICATION_COLORS as an object", () => {
    expect(CLASSIFICATION_COLORS).toBeDefined();
    expect(typeof CLASSIFICATION_COLORS).toBe("object");
  });

  it("exports CLASSIFICATION_SYMBOLS as an object", () => {
    expect(CLASSIFICATION_SYMBOLS).toBeDefined();
    expect(typeof CLASSIFICATION_SYMBOLS).toBe("object");
  });
});

describe("barrel exports: openings", () => {
  it("exports ECO_DATABASE as an array", () => {
    expect(Array.isArray(ECO_DATABASE)).toBe(true);
    expect(ECO_DATABASE.length).toBeGreaterThan(0);
  });

  it("exports lookupOpening as a function", () => {
    expect(typeof lookupOpening).toBe("function");
  });
});

describe("barrel exports: reactions", () => {
  it("exports REACTIONS as an object", () => {
    expect(REACTIONS).toBeDefined();
    expect(typeof REACTIONS).toBe("object");
  });

  it("exports VALID_REACTIONS as an array", () => {
    expect(Array.isArray(VALID_REACTIONS)).toBe(true);
  });
});
