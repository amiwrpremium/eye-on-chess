import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { apiError, VALIDATION_FAILED, NOT_FOUND } from "../lib/errorCodes.js";

/** Register user routes (profile, search, update, avatar). */
export async function userRoutes(app: FastifyInstance) {
  // Search users by partial username
  app.get<{ Querystring: { q?: string } }>(
    "/users/search",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const query = request.query.q?.trim();
      if (!query || query.length < 1) {
        return apiError(reply, 400, VALIDATION_FAILED, "Query parameter 'q' is required");
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

  // Public profile with optional H2H
  app.get<{ Params: { username: string }; Querystring: { vsUserId?: string } }>(
    "/users/:username",
    async (request, reply) => {
      const { username } = request.params;
      const { vsUserId } = request.query;

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
        return apiError(reply, 404, NOT_FOUND, "User not found");
      }

      // Build filter: global or H2H
      const h2h = vsUserId && vsUserId !== user.id;
      const baseWhere = h2h
        ? {
            status: "COMPLETED" as const,
            OR: [
              { whiteId: user.id, blackId: vsUserId },
              { whiteId: vsUserId, blackId: user.id },
            ],
          }
        : {
            status: "COMPLETED" as const,
            OR: [{ whiteId: user.id }, { blackId: user.id }],
          };

      const [wins, losses, draws] = await Promise.all([
        prisma.game.count({
          where: {
            ...baseWhere,
            OR: h2h
              ? [
                  { whiteId: user.id, blackId: vsUserId, result: "WHITE_WIN" },
                  { blackId: user.id, whiteId: vsUserId, result: "BLACK_WIN" },
                ]
              : [
                  { whiteId: user.id, result: "WHITE_WIN" },
                  { blackId: user.id, result: "BLACK_WIN" },
                ],
          },
        }),
        prisma.game.count({
          where: {
            ...baseWhere,
            OR: h2h
              ? [
                  { whiteId: user.id, blackId: vsUserId, result: "BLACK_WIN" },
                  { blackId: user.id, whiteId: vsUserId, result: "WHITE_WIN" },
                ]
              : [
                  { whiteId: user.id, result: "BLACK_WIN" },
                  { blackId: user.id, result: "WHITE_WIN" },
                ],
          },
        }),
        prisma.game.count({
          where: {
            status: "COMPLETED",
            result: "DRAW",
            OR: h2h
              ? [
                  { whiteId: user.id, blackId: vsUserId },
                  { whiteId: vsUserId, blackId: user.id },
                ]
              : [{ whiteId: user.id }, { blackId: user.id }],
          },
        }),
      ]);

      // Recent games (H2H or global)
      const recentGames = await prisma.game.findMany({
        where: {
          status: "COMPLETED",
          OR: h2h
            ? [
                { whiteId: user.id, blackId: vsUserId },
                { whiteId: vsUserId, blackId: user.id },
              ]
            : [{ whiteId: user.id }, { blackId: user.id }],
        },
        select: {
          id: true,
          result: true,
          termination: true,
          timeControl: true,
          createdAt: true,
          whiteId: true,
          blackId: true,
          white: { select: { username: true } },
          black: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return {
        user: {
          ...user,
          stats: { wins, losses, draws, total: wins + losses + draws },
          recentGames,
          isH2H: !!h2h,
        },
      };
    }
  );
}
