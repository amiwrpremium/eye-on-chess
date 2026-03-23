import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { createCollectionBodySchema, addGameToCollectionBodySchema } from "../lib/schemas.js";
import {
  apiError,
  COLLECTION_NOT_FOUND,
  COLLECTION_FORBIDDEN,
  COLLECTION_FAVORITES_PROTECTED,
  COLLECTION_NAME_EXISTS,
} from "../lib/errorCodes.js";

/** Register collection routes (create, update, delete, manage game collections). */
export async function collectionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // List my collections
  app.get("/collections", async (request) => {
    const userId = request.user.userId;
    const collections = await prisma.collection.findMany({
      where: { userId },
      include: { _count: { select: { games: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        gameCount: c._count.games,
        createdAt: c.createdAt,
      })),
    };
  });

  // Create collection
  app.post<{ Body: { name: string } }>(
    "/collections",
    { schema: { body: createCollectionBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { name } = request.body;

      const trimmed = name.trim().slice(0, 50);

      const existing = await prisma.collection.findUnique({
        where: { userId_name: { userId, name: trimmed } },
      });
      if (existing) {
        return apiError(
          reply,
          409,
          COLLECTION_NAME_EXISTS,
          "Collection with this name already exists"
        );
      }

      const collection = await prisma.collection.create({
        data: { userId, name: trimmed },
      });

      return { collection };
    }
  );

  // Delete collection
  app.delete<{ Params: { id: string } }>("/collections/:id", async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params;

    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection) return apiError(reply, 404, COLLECTION_NOT_FOUND, "Collection not found");
    if (collection.userId !== userId)
      return apiError(reply, 403, COLLECTION_FORBIDDEN, "Not your collection");
    if (collection.name === "Favorites") {
      return apiError(
        reply,
        400,
        COLLECTION_FAVORITES_PROTECTED,
        "Cannot delete Favorites collection"
      );
    }

    await prisma.collection.delete({ where: { id } });
    return { success: true };
  });

  // List games in collection
  app.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    "/collections/:id/games",
    async (request, reply) => {
      const userId = request.user.userId;
      const { id } = request.params;
      const { page, limit, skip, take } = parsePagination(request.query);

      const collection = await prisma.collection.findUnique({ where: { id } });
      if (!collection) return apiError(reply, 404, COLLECTION_NOT_FOUND, "Collection not found");
      if (collection.userId !== userId)
        return apiError(reply, 403, COLLECTION_FORBIDDEN, "Not your collection");

      const [items, total] = await Promise.all([
        prisma.gameCollection.findMany({
          where: { collectionId: id },
          include: {
            game: {
              select: {
                id: true,
                status: true,
                result: true,
                termination: true,
                timeControl: true,
                isVsBot: true,
                botElo: true,
                createdAt: true,
                whiteId: true,
                blackId: true,
                white: { select: { username: true, rating: true } },
                black: { select: { username: true, rating: true } },
              },
            },
          },
          orderBy: { id: "desc" },
          skip,
          take,
        }),
        prisma.gameCollection.count({ where: { collectionId: id } }),
      ]);

      return {
        collection: { id: collection.id, name: collection.name },
        games: items.map((i) => i.game),
        pagination: paginationMeta(page, limit, total),
      };
    }
  );

  // Add game to collection
  app.post<{ Params: { id: string }; Body: { gameId: string } }>(
    "/collections/:id/games",
    async (request, reply) => {
      const userId = request.user.userId;
      const { id } = request.params;
      const { gameId } = request.body;

      const collection = await prisma.collection.findUnique({ where: { id } });
      if (!collection) return apiError(reply, 404, COLLECTION_NOT_FOUND, "Collection not found");
      if (collection.userId !== userId)
        return apiError(reply, 403, COLLECTION_FORBIDDEN, "Not your collection");

      const existing = await prisma.gameCollection.findUnique({
        where: { gameId_collectionId: { gameId, collectionId: id } },
      });
      if (existing) return { success: true, message: "Already in collection" };

      await prisma.gameCollection.create({ data: { gameId, collectionId: id } });
      return { success: true };
    }
  );

  // Remove game from collection
  app.delete<{ Params: { id: string; gameId: string } }>(
    "/collections/:id/games/:gameId",
    async (request, reply) => {
      const userId = request.user.userId;
      const { id, gameId } = request.params;

      const collection = await prisma.collection.findUnique({ where: { id } });
      if (!collection) return apiError(reply, 404, COLLECTION_NOT_FOUND, "Collection not found");
      if (collection.userId !== userId)
        return apiError(reply, 403, COLLECTION_FORBIDDEN, "Not your collection");

      await prisma.gameCollection
        .delete({ where: { gameId_collectionId: { gameId, collectionId: id } } })
        .catch(() => {});
      return { success: true };
    }
  );

  // Get which collections a game belongs to (for the current user)
  app.get<{ Params: { id: string } }>("/games/:id/collections", async (request) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;

    const memberships = await prisma.gameCollection.findMany({
      where: {
        gameId,
        collection: { userId },
      },
      include: { collection: { select: { id: true, name: true } } },
    });

    return {
      collections: memberships.map((m) => m.collection),
    };
  });
}
