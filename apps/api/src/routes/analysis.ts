import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { authMiddleware } from "../middleware/auth.js";
import { lookupOpening } from "../lib/eco.js";

const QUEUE_KEY = "analysis:queue";

function statusKey(gameId: string) {
  return `analysis:status:${gameId}`;
}

export async function analysisRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Queue analysis job
  app.post<{ Params: { id: string } }>("/api/games/:id/analyze", async (request, reply) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        status: true,
        whiteId: true,
        blackId: true,
      },
    });

    if (!game) {
      return reply.status(404).send({ error: "Game not found" });
    }

    if (game.status !== "COMPLETED") {
      return reply.status(400).send({ error: "Game must be completed" });
    }

    if (game.whiteId !== userId && game.blackId !== userId) {
      return reply.status(403).send({ error: "Must be a player in this game" });
    }

    // Check if already queued/processing
    const status = await redis.get(statusKey(gameId));
    if (status === "queued" || status === "processing") {
      return { status, message: "Analysis already in progress" };
    }

    // Queue the job
    await redis.rpush(QUEUE_KEY, gameId);
    await redis.set(statusKey(gameId), "queued");

    return { status: "queued", message: "Analysis queued" };
  });

  // Get analysis results
  app.get<{ Params: { id: string } }>("/api/games/:id/analysis", async (request, reply) => {
    const { id: gameId } = request.params;

    // Check job status
    const jobStatus = await redis.get(statusKey(gameId));

    const analysis = await prisma.gameAnalysis.findUnique({
      where: { gameId },
      include: {
        feedback: {
          orderBy: { ply: "asc" },
          include: {
            move: {
              select: { ply: true, san: true, uci: true, fen: true },
            },
          },
        },
      },
    });

    if (!analysis) {
      return {
        status: jobStatus || "none",
        analysis: null,
      };
    }

    // Lookup opening
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { moves: { orderBy: { ply: "asc" }, select: { san: true } } },
    });
    const moveSans = game?.moves.map((m) => m.san) || [];
    const opening = lookupOpening(moveSans);

    return {
      status: "done",
      analysis: {
        id: analysis.id,
        whiteAccuracy: analysis.whiteAccuracy,
        blackAccuracy: analysis.blackAccuracy,
        opening,
        feedback: analysis.feedback.map((f) => ({
          ply: f.ply,
          san: f.move.san,
          uci: f.move.uci,
          fen: f.move.fen,
          classification: f.classification,
          bestMove: f.bestMove,
          evalBefore: f.evalBefore,
          evalAfter: f.evalAfter,
        })),
      },
    };
  });
}
