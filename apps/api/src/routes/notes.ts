import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { sanitizeString } from "../middleware/admin.js";

const MAX_NOTE_LENGTH = 2000;

/** Register note routes (create, update, delete game notes). */
export async function noteRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Get my note for a game
  app.get<{ Params: { id: string } }>("/api/games/:id/notes", async (request) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;

    const note = await prisma.gameNote.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: { text: true, updatedAt: true },
    });

    return { note: note ? { text: note.text, updatedAt: note.updatedAt } : null };
  });

  // Create/update/delete my note for a game
  app.put<{ Params: { id: string }; Body: { text?: string } }>(
    "/api/games/:id/notes",
    async (request, reply) => {
      const userId = request.user.userId;
      const { id: gameId } = request.params;
      const { text } = request.body;

      // Verify game exists
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
      if (!game) {
        return reply.status(404).send({ error: "Game not found" });
      }

      // Delete if empty
      if (!text || text.trim().length === 0) {
        await prisma.gameNote
          .delete({ where: { userId_gameId: { userId, gameId } } })
          .catch(() => {});
        return { note: null };
      }

      // Validate length
      const sanitized = sanitizeString(text).slice(0, MAX_NOTE_LENGTH);

      const note = await prisma.gameNote.upsert({
        where: { userId_gameId: { userId, gameId } },
        update: { text: sanitized },
        create: { userId, gameId, text: sanitized },
        select: { text: true, updatedAt: true },
      });

      return { note };
    }
  );
}
