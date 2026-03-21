import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export async function userRoutes(app: FastifyInstance) {
  // Search users by partial username
  app.get<{ Querystring: { q?: string } }>(
    "/api/users/search",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const query = request.query.q?.trim();
      if (!query || query.length < 1) {
        return reply.status(400).send({ error: "Query parameter 'q' is required" });
      }

      const users = await prisma.user.findMany({
        where: {
          username: { contains: query, mode: "insensitive" },
          id: { not: request.user.userId },
        },
        select: {
          id: true,
          username: true,
          rating: true,
          avatarUrl: true,
        },
        take: 20,
      });

      return { users };
    }
  );

  // Public profile
  app.get<{ Params: { username: string } }>("/api/users/:username", async (request, reply) => {
    const { username } = request.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        rating: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Game stats from completed games
    const [wins, losses, draws] = await Promise.all([
      prisma.game.count({
        where: {
          status: "COMPLETED",
          OR: [
            { whiteId: user.id, result: "WHITE_WIN" },
            { blackId: user.id, result: "BLACK_WIN" },
          ],
        },
      }),
      prisma.game.count({
        where: {
          status: "COMPLETED",
          OR: [
            { whiteId: user.id, result: "BLACK_WIN" },
            { blackId: user.id, result: "WHITE_WIN" },
          ],
        },
      }),
      prisma.game.count({
        where: {
          status: "COMPLETED",
          result: "DRAW",
          OR: [{ whiteId: user.id }, { blackId: user.id }],
        },
      }),
    ]);

    return {
      user: {
        ...user,
        stats: { wins, losses, draws, total: wins + losses + draws },
      },
    };
  });
}
