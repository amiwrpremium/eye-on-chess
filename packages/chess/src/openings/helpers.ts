import type { Opening } from "./types.js";
import { ECO_DATABASE } from "./data.js";

/**
 * Look up the opening name and ECO code from a sequence of SAN moves.
 * Uses longest prefix match against the ECO database.
 *
 * @param moveSans - array of SAN move strings (e.g. `["e4", "e5", "Nf3"]`)
 * @returns the matched opening, or `null` if no match
 */
export function lookupOpening(moveSans: string[]): Opening | null {
  const moveString = moveSans.join(" ");

  for (const entry of ECO_DATABASE) {
    if (moveString.startsWith(entry.moves)) {
      return { name: entry.name, eco: entry.eco };
    }
  }

  return null;
}
