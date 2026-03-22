export interface GameModeSettings {
  hints: boolean;
  evalBar: boolean;
  threats: boolean;
  suggestions: boolean;
  moveFeedback: boolean;
  takeback: boolean;
  engine: boolean; // show engine eval line
}

export type GameModePreset = "challenge" | "friendly" | "assisted" | "custom";

export const GAME_MODE_PRESETS: Record<Exclude<GameModePreset, "custom">, GameModeSettings> = {
  challenge: {
    hints: false,
    evalBar: false,
    threats: false,
    suggestions: false,
    moveFeedback: false,
    takeback: false,
    engine: false,
  },
  friendly: {
    hints: true,
    evalBar: false,
    threats: false,
    suggestions: false,
    moveFeedback: false,
    takeback: true,
    engine: false,
  },
  assisted: {
    hints: true,
    evalBar: true,
    threats: true,
    suggestions: true,
    moveFeedback: true,
    takeback: false,
    engine: true,
  },
};

export const GAME_MODE_LABELS: Record<GameModePreset, { name: string; desc: string }> = {
  challenge: { name: "Challenge", desc: "No help of any kind" },
  friendly: { name: "Friendly", desc: "Hints and takebacks allowed" },
  assisted: { name: "Assisted", desc: "All tools available" },
  custom: { name: "Custom", desc: "Choose your tools" },
};

export const DEFAULT_CUSTOM: GameModeSettings = {
  hints: true,
  evalBar: true,
  threats: false,
  suggestions: false,
  moveFeedback: true,
  takeback: false,
  engine: false,
};
