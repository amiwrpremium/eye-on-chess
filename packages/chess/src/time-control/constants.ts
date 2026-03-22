import type { TimeControlPreset, TimeControl } from "./types.js";

/**
 * Standard time control presets available throughout the app.
 * Keys are used as preset identifiers in API requests.
 */
export const TIME_CONTROL_PRESETS: Record<string, TimeControlPreset> = {
  bullet_1_0: { label: "1+0", timeControl: "BULLET", initialTime: 60, increment: 0 },
  bullet_2_1: { label: "2+1", timeControl: "BULLET", initialTime: 120, increment: 1 },
  blitz_3_0: { label: "3+0", timeControl: "BLITZ", initialTime: 180, increment: 0 },
  blitz_3_2: { label: "3+2", timeControl: "BLITZ", initialTime: 180, increment: 2 },
  blitz_5_0: { label: "5+0", timeControl: "BLITZ", initialTime: 300, increment: 0 },
  blitz_5_3: { label: "5+3", timeControl: "BLITZ", initialTime: 300, increment: 3 },
  rapid_10_0: { label: "10+0", timeControl: "RAPID", initialTime: 600, increment: 0 },
  rapid_15_10: { label: "15+10", timeControl: "RAPID", initialTime: 900, increment: 10 },
  classical_30_0: { label: "30+0", timeControl: "CLASSICAL", initialTime: 1800, increment: 0 },
  unlimited: { label: "Unlimited", timeControl: "UNLIMITED", initialTime: 0, increment: 0 },
};

/**
 * Determine the time control category from initial time and increment.
 *
 * Uses the standard formula: `totalSeconds = initialTime + increment * 40`.
 *
 * @param initialTime - initial time in seconds
 * @param increment - increment in seconds
 * @returns the appropriate {@link TimeControl} category
 */
export function categorizeTimeControl(initialTime: number, increment: number): TimeControl {
  if (initialTime === 0 && increment === 0) return "UNLIMITED";
  const totalSeconds = initialTime + increment * 40;
  if (totalSeconds < 180) return "BULLET";
  if (totalSeconds < 480) return "BLITZ";
  if (totalSeconds < 1500) return "RAPID";
  return "CLASSICAL";
}
