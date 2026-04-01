import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { StockfishEngine } from "./lib/stockfish.js";
import { classifyMove, computeAccuracy } from "./lib/classify.js";
import { createChildLogger } from "./lib/logger.js";
import { Chess } from "chess.js";

const log = createChildLogger("worker");

const QUEUE_KEY = "analysis:queue";
const DLQ_KEY = "analysis:dlq";
const POLL_INTERVAL = 2000;
const DEPTH = 18;
const MAX_RETRIES = 3;

function statusKey(gameId: string) {
  return `analysis:status:${gameId}`;
}

function progressKey(gameId: string) {
  return `analysis:progress:${gameId}`;
}

async function analyzeGame(gameId: string, engine: StockfishEngine) {
  await redis.set(statusKey(gameId), "processing");
  log.info({ gameId }, "analyzing game");

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
    log.warn({ gameId }, "game not found or has no moves");
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
    // move.fen is the position AFTER the move — reconstruct from start
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

    // Update progress in Redis for real-time tracking
    await redis.setex(
      progressKey(gameId),
      3600,
      JSON.stringify({ currentMove: move.ply, totalMoves: game.moves.length })
    );

    prevEval = evalAfterResult;
  }

  // Clean up progress key
  await redis.del(progressKey(gameId));

  // Compute accuracy
  const whiteAccuracy = computeAccuracy(whiteCPLosses);
  const blackAccuracy = computeAccuracy(blackCPLosses);

  await prisma.gameAnalysis.update({
    where: { id: analysis.id },
    data: { whiteAccuracy, blackAccuracy },
  });

  await redis.set(statusKey(gameId), "done");
  log.info({ gameId, whiteAccuracy, blackAccuracy }, "analysis complete");
}

function retryKey(gameId: string) {
  return `analysis:retries:${gameId}`;
}

async function initEngine(): Promise<StockfishEngine> {
  const engine = new StockfishEngine();
  await engine.init();
  log.info("stockfish initialized");
  return engine;
}

async function main() {
  log.info("starting analysis worker");

  let engine = await initEngine();
  let consecutiveFailures = 0;

  // Poll loop
  while (true) {
    try {
      const gameId = await redis.lpop(QUEUE_KEY);
      if (gameId) {
        try {
          await analyzeGame(gameId, engine);
          consecutiveFailures = 0;
        } catch (err) {
          consecutiveFailures++;
          log.error({ gameId, err, consecutiveFailures }, "error analyzing game");

          // Track retries per game
          const retries = await redis.incr(retryKey(gameId));
          await redis.expire(retryKey(gameId), 3600);

          if (retries >= MAX_RETRIES) {
            // Move to dead letter queue — stop retrying this game
            await redis.lpush(DLQ_KEY, gameId);
            await redis.set(statusKey(gameId), "error");
            await redis.del(retryKey(gameId));
            log.warn({ gameId, retries }, "moved to dead letter queue after max retries");
          } else {
            // Re-queue for retry
            await redis.rpush(QUEUE_KEY, gameId);
            await redis.set(statusKey(gameId), "queued");
            log.info({ gameId, retries }, "re-queued for retry");
          }

          // Circuit breaker — if engine keeps failing, restart it
          if (consecutiveFailures >= 3) {
            log.warn("circuit breaker: restarting stockfish engine after 3 consecutive failures");
            try {
              engine.destroy();
            } catch {
              // ignore destroy errors
            }
            await new Promise((r) => setTimeout(r, 2000));
            engine = await initEngine();
            consecutiveFailures = 0;
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (err) {
      log.error({ err }, "poll error");
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

main().catch((err) => {
  log.fatal({ err }, "fatal error");
  process.exit(1);
});
