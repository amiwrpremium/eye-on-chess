import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { StockfishEngine } from "./lib/stockfish.js";
import { classifyMove, computeAccuracy } from "./lib/classify.js";
import { lookupOpening } from "./lib/eco.js";
import { Chess } from "chess.js";

const QUEUE_KEY = "analysis:queue";
const POLL_INTERVAL = 2000;
const DEPTH = 18;

function statusKey(gameId: string) {
  return `analysis:status:${gameId}`;
}

async function analyzeGame(gameId: string, engine: StockfishEngine) {
  await redis.set(statusKey(gameId), "processing");
  console.log(`[Worker] Analyzing game ${gameId}`);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      moves: { orderBy: { ply: "asc" } },
      white: { select: { id: true } },
      black: { select: { id: true } },
    },
  });

  if (!game || game.moves.length === 0) {
    await redis.set(statusKey(gameId), "error");
    console.log(`[Worker] Game ${gameId} not found or has no moves`);
    return;
  }

  // Delete existing analysis if re-analyzing
  await prisma.gameAnalysis.deleteMany({ where: { gameId } });

  // Create analysis record
  const analysis = await prisma.gameAnalysis.create({
    data: { gameId },
  });

  // Evaluate starting position
  const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  let prevEval = await engine.evaluatePosition(startingFen, DEPTH);

  const whiteCPLosses: number[] = [];
  const blackCPLosses: number[] = [];
  const moveSans: string[] = [];

  for (const move of game.moves) {
    moveSans.push(move.san);

    // Get the position BEFORE this move
    const chess = new Chess(move.fen);
    // move.fen is the position AFTER the move
    // We need the position before — reconstruct from start
    const beforeChess = new Chess(startingFen);
    for (let i = 0; i < game.moves.indexOf(move); i++) {
      beforeChess.move(game.moves[i].san);
    }
    const fenBefore = beforeChess.fen();

    const isBlackMove = move.ply % 2 === 0;

    // Evaluate position AFTER this move
    const evalAfterResult = await engine.evaluatePosition(move.fen, DEPTH);

    // Get multi-PV for brilliant detection (position before, 2 lines)
    let nextBestEval: number | null = null;
    try {
      const multiPV = await engine.evaluatePositionMultiPV(fenBefore, DEPTH, 2);
      if (multiPV.length >= 2) {
        nextBestEval = multiPV[1].score;
      }
    } catch {
      // Fallback: no multi-PV data
    }

    const classified = classifyMove(
      fenBefore,
      move.uci,
      prevEval.score,
      evalAfterResult.score,
      prevEval.bestMove,
      nextBestEval
    );

    // Track CP losses per player
    if (isBlackMove) {
      blackCPLosses.push(classified.cpLoss);
    } else {
      whiteCPLosses.push(classified.cpLoss);
    }

    // Save move feedback
    await prisma.moveFeedback.create({
      data: {
        analysisId: analysis.id,
        moveId: move.id,
        ply: move.ply,
        classification: classified.classification,
        bestMove: classified.bestMove,
        evalBefore: classified.evalBefore,
        evalAfter: classified.evalAfter,
      },
    });

    prevEval = evalAfterResult;
  }

  // Compute accuracy
  const whiteAccuracy = computeAccuracy(whiteCPLosses);
  const blackAccuracy = computeAccuracy(blackCPLosses);

  await prisma.gameAnalysis.update({
    where: { id: analysis.id },
    data: { whiteAccuracy, blackAccuracy },
  });

  await redis.set(statusKey(gameId), "done");
  console.log(
    `[Worker] Analysis complete for ${gameId}: white=${whiteAccuracy}%, black=${blackAccuracy}%`
  );
}

async function main() {
  console.log("[Worker] Starting analysis worker...");

  const engine = new StockfishEngine();
  await engine.init();
  console.log("[Worker] Stockfish initialized");

  // Poll loop
  while (true) {
    try {
      const gameId = await redis.lpop(QUEUE_KEY);
      if (gameId) {
        try {
          await analyzeGame(gameId, engine);
        } catch (err) {
          console.error(`[Worker] Error analyzing game ${gameId}:`, err);
          await redis.set(statusKey(gameId), "error");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (err) {
      console.error("[Worker] Poll error:", err);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
