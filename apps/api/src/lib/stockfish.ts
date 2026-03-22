import { spawn, ChildProcessWithoutNullStreams } from "child_process";

const STOCKFISH_PATH = process.env.STOCKFISH_PATH || "stockfish";

/** Engine evaluation result for a single position. */
export interface EvalResult {
  score: number; // centipawns (from white's perspective)
  mate: number | null; // mate in N (positive = white mates, negative = black mates)
  bestMove: string; // UCI format e.g. "e2e4"
}

/** Wrapper around the Stockfish UCI chess engine for position evaluation. */
export class StockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private resolveCallback: ((value: string[]) => void) | null = null;
  private lines: string[] = [];

  /** Spawn the Stockfish process and wait for UCI initialization. */
  async init(): Promise<void> {
    this.process = spawn(STOCKFISH_PATH);
    this.process.stdout.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      const parts = this.buffer.split("\n");
      this.buffer = parts.pop() || "";
      for (const line of parts) {
        this.lines.push(line.trim());
        if (line.includes("bestmove") || line.includes("uciok") || line.includes("readyok")) {
          if (this.resolveCallback) {
            const cb = this.resolveCallback;
            this.resolveCallback = null;
            cb(this.lines);
            this.lines = [];
          }
        }
      }
    });

    await this.send("uci", "uciok");
    await this.send("isready", "readyok");
  }

  /**
   * Send a UCI command and wait for a specific response keyword.
   * @param command - The UCI command string.
   * @param waitFor - The keyword to wait for in the engine output.
   * @returns All output lines received until the keyword was found.
   */
  send(command: string, waitFor: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error("Stockfish not initialized"));
        return;
      }
      this.lines = [];
      this.resolveCallback = resolve;
      this.process.stdin.write(command + "\n");

      // Timeout after 30s
      setTimeout(() => {
        if (this.resolveCallback === resolve) {
          this.resolveCallback = null;
          reject(new Error(`Stockfish timeout waiting for ${waitFor}`));
        }
      }, 30000);
    });
  }

  /**
   * Evaluate a position and return the best move with score.
   * @param fen - The position in FEN notation.
   * @param depth - Search depth (default 18).
   * @returns The evaluation result with score from white's perspective.
   */
  async evaluatePosition(fen: string, depth: number = 18): Promise<EvalResult> {
    if (!this.process) throw new Error("Stockfish not initialized");

    this.process.stdin.write("ucinewgame\n");
    await this.send("isready", "readyok");

    this.process.stdin.write(`position fen ${fen}\n`);
    const lines = await this.send(`go depth ${depth}`, "bestmove");

    let score = 0;
    let mate: number | null = null;
    let bestMove = "";

    // Parse the last info line with the target depth
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        bestMove = parts[1] || "";
      }

      if (
        line.includes(`info depth ${depth}`) ||
        (line.includes("info depth") && line.includes("score"))
      ) {
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);

        if (mateMatch) {
          mate = parseInt(mateMatch[1]);
          score = mate > 0 ? 100000 : -100000;
        } else if (scoreMatch) {
          score = parseInt(scoreMatch[1]);
        }

        // Use the deepest info line we found
        if (scoreMatch || mateMatch) break;
      }
    }

    // Scores are from the side to move's perspective
    // Convert to white's perspective
    const isBlackToMove = fen.split(" ")[1] === "b";
    if (isBlackToMove) {
      score = -score;
      if (mate !== null) mate = -mate;
    }

    return { score, mate, bestMove };
  }

  /**
   * Evaluate a position with multiple principal variations.
   * @param fen - The position in FEN notation.
   * @param depth - Search depth (default 18).
   * @param multiPV - Number of principal variations to return (default 2).
   * @returns Array of evaluation results, one per PV line.
   */
  async evaluatePositionMultiPV(
    fen: string,
    depth: number = 18,
    multiPV: number = 2
  ): Promise<EvalResult[]> {
    if (!this.process) throw new Error("Stockfish not initialized");

    this.process.stdin.write("ucinewgame\n");
    this.process.stdin.write(`setoption name MultiPV value ${multiPV}\n`);
    await this.send("isready", "readyok");

    this.process.stdin.write(`position fen ${fen}\n`);
    const lines = await this.send(`go depth ${depth}`, "bestmove");

    const results: EvalResult[] = [];
    const isBlackToMove = fen.split(" ")[1] === "b";

    // Find bestmove
    let bestMoveUCI = "";
    for (const line of lines) {
      if (line.startsWith("bestmove")) {
        bestMoveUCI = line.split(" ")[1] || "";
        break;
      }
    }

    // Collect results for each PV at max depth
    for (let pv = 1; pv <= multiPV; pv++) {
      let found = false;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.includes("info depth") || !line.includes(`multipv ${pv}`)) continue;

        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (\S+)/);

        let score = 0;
        let mate: number | null = null;

        if (mateMatch) {
          mate = parseInt(mateMatch[1]);
          score = mate > 0 ? 100000 : -100000;
        } else if (scoreMatch) {
          score = parseInt(scoreMatch[1]);
        }

        if (isBlackToMove) {
          score = -score;
          if (mate !== null) mate = -mate;
        }

        results.push({
          score,
          mate,
          bestMove: pvMatch ? pvMatch[1] : pv === 1 ? bestMoveUCI : "",
        });
        found = true;
        break;
      }
      if (!found && pv === 1) {
        results.push({ score: 0, mate: null, bestMove: bestMoveUCI });
      }
    }

    // Reset MultiPV
    this.process.stdin.write("setoption name MultiPV value 1\n");

    return results;
  }

  /** Quit the Stockfish process and release resources. */
  destroy(): void {
    if (this.process) {
      this.process.stdin.write("quit\n");
      this.process.kill();
      this.process = null;
    }
  }
}
