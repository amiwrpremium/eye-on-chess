"use client";

import { useStockfish } from "./useStockfish";
import { computeCustomMove, getStockfishConfig, type BotPersonality } from "@eyeonchess/chess";

/**
 * Hook that combines the bot personality system with Stockfish.
 *
 * Delegates move generation to different engines based on the bot's tier:
 * - **custom** (200-1200): Pure JS minimax with personality quirks via `computeCustomMove`.
 * - **hybrid** (1300-1900): Stockfish at limited depth with blunder injection.
 * - **engine** (2000+): Stockfish with UCI_Elo strength limiting.
 *
 * Also proxies the `evaluate` and `ready` state from the underlying `useStockfish` hook
 * so callers only need a single interface.
 *
 * @returns An object with `ready`, `evaluate`, `getBotMove` (raw Stockfish),
 *   and `getPersonalityMove` (personality-aware move selection).
 */
export function useBotEngine() {
  const stockfish = useStockfish();

  /**
   * Get a move for the given position using the bot's personality tier.
   *
   * @param fen - The current board position in FEN notation.
   * @param personality - The bot personality that determines engine tier and behavior.
   * @returns A UCI move string (e.g. "e2e4") or `null` if no move could be computed.
   */
  async function getPersonalityMove(
    fen: string,
    personality: BotPersonality
  ): Promise<string | null> {
    if (personality.tier === "custom") {
      // Run JS engine (fast, no async needed for depth 1-3)
      return computeCustomMove(fen, personality);
    }

    if (personality.tier === "hybrid") {
      const config = getStockfishConfig(personality);
      // Use stockfish at limited depth
      if (!stockfish.ready) return null;
      const move = await stockfish.getBotMove(fen, personality.elo);
      // Apply blunder chance -- replace with random move
      if (move && Math.random() < config.blunderChance) {
        // Get random legal move instead
        const { Chess } = await import("chess.js");
        const chess = new Chess(fen);
        const moves = chess.moves({ verbose: true });
        if (moves.length > 0) {
          const rand = moves[Math.floor(Math.random() * moves.length)];
          return `${rand.from}${rand.to}${rand.promotion || ""}`;
        }
      }
      return move;
    }

    // Engine tier -- use Stockfish with UCI_Elo
    if (!stockfish.ready) return null;
    return stockfish.getBotMove(fen, personality.elo);
  }

  return { ...stockfish, getPersonalityMove };
}
