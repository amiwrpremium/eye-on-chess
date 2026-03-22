/**
 * An ECO opening entry with its move sequence.
 */
export interface OpeningEntry {
  /** SAN move sequence separated by spaces (e.g. "e4 e5 Nf3 Nc6 Bb5") */
  moves: string;
  /** Opening name (e.g. "Ruy Lopez") */
  name: string;
  /** ECO code (e.g. "C60") */
  eco: string;
}

/**
 * A matched opening result.
 */
export interface Opening {
  /** Opening name */
  name: string;
  /** ECO code */
  eco: string;
}
