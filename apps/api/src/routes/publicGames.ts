import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { apiError, GAME_NOT_FOUND, GAME_NOT_SHAREABLE } from "../lib/errorCodes.js";

/** Public game routes — no authentication required. */
export async function publicGameRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/games/:id/view", async (request, reply) => {
    const { id } = request.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        white: { select: { username: true, rating: true } },
        black: { select: { username: true, rating: true } },
        moves: {
          orderBy: { ply: "asc" },
          select: { ply: true, san: true, uci: true, fen: true },
        },
      },
    });

    if (!game) return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");

    if (game.status !== "COMPLETED" && game.status !== "ABORTED") {
      return apiError(reply, 403, GAME_NOT_SHAREABLE, "Only completed games can be shared");
    }

    return {
      game: {
        id: game.id,
        status: game.status,
        result: game.result,
        termination: game.termination,
        timeControl: game.timeControl,
        fen: game.fen,
        pgn: game.pgn,
        isVsBot: game.isVsBot,
        botElo: game.botElo,
        createdAt: game.createdAt,
        endedAt: game.endedAt,
        white: game.white,
        black: game.black,
        moves: game.moves,
      },
    };
  });
}
