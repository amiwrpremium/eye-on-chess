import { StockfishEngine } from "./stockfish.js";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("bot-engine");

let engine: StockfishEngine | null = null;
let currentElo: number | null = null;

async function getEngine(): Promise<StockfishEngine> {
  if (!engine) {
    engine = new StockfishEngine();
    await engine.init();
    log.info("bot stockfish engine initialized");
  }
  return engine;
}

/**
 * Get the best move from the bot engine at a given Elo strength.
 * @param fen - The current board position in FEN notation.
 * @param elo - Target Elo strength for the bot (clamped to 200-3200).
 * @param maxTimeMs - Maximum thinking time in milliseconds.
 * @returns The best move in UCI format (e.g. "e2e4").
 */
export async function getBotMove(
  fen: string,
  elo: number,
  maxTimeMs: number = 2000
): Promise<string> {
  const eng = await getEngine();
  const proc = eng["process"];
  if (!proc) throw new Error("Engine not initialized");

  const clampedElo = Math.max(200, Math.min(3200, elo));

  // Set UCI_Elo and Skill Level if changed
  if (currentElo !== clampedElo) {
    proc.stdin.write("setoption name UCI_LimitStrength value true\n");
    proc.stdin.write(`setoption name UCI_Elo value ${clampedElo}\n`);

    // Skill Level 0-20 mapped from elo (additional weakness control)
    // Stockfish Skill Level adds random errors at low levels
    const skillLevel = Math.min(20, Math.max(0, Math.floor((clampedElo - 200) / 150)));
    proc.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);

    await eng.send("isready", "readyok");
    currentElo = clampedElo;
  }

  proc.stdin.write("ucinewgame\n");
  proc.stdin.write(`position fen ${fen}\n`);
  await eng.send("isready", "readyok");

  // Think time: very short at low elo, longer at high elo
  // Low elo bots should think less (fewer nodes = weaker)
  const thinkTime = Math.min(maxTimeMs, Math.max(100, Math.floor(clampedElo / 4)));

  // Also limit depth at low elos
  const maxDepth = clampedElo < 600 ? 3 : clampedElo < 1200 ? 6 : clampedElo < 2000 ? 10 : 18;

  const lines = await eng.send(`go movetime ${thinkTime} depth ${maxDepth}`, "bestmove");

  let bestMove = "";
  for (const line of lines) {
    if (line.startsWith("bestmove")) {
      bestMove = line.split(" ")[1] || "";
      break;
    }
  }

  if (!bestMove) {
    log.error({ fen, elo: clampedElo }, "bot engine returned no move");
    throw new Error("Bot engine returned no move");
  }

  return bestMove;
}
