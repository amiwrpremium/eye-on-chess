import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const BATCH_SIZE = 10;
const UNLOCK_THRESHOLD = 0.75;

/** Register invite routes (create, accept, decline, list invites). */
export async function inviteRoutes(app: FastifyInstance) {
  // Validate invite (public — no auth needed)
  app.get<{ Params: { code: string } }>("/api/invites/validate/:code", async (request, reply) => {
    const { code } = request.params;
    const invite = await prisma.invite.findUnique({
      where: { code },
      select: { id: true, usedById: true },
    });
    if (!invite) return reply.status(404).send({ valid: false, error: "Invite not found" });
    if (invite.usedById)
      return reply.status(410).send({ valid: false, error: "Invite already used" });
    return { valid: true };
  });

  // All routes below require auth
  app.register(async (authed) => {
    authed.addHook("preHandler", authMiddleware);

    // My invite stats
    authed.get("/api/invites/stats", async (request) => {
      const userId = request.user.userId;
      const [totalCreated, totalUsed] = await Promise.all([
        prisma.invite.count({ where: { creatorId: userId } }),
        prisma.invite.count({ where: { creatorId: userId, usedById: { not: null } } }),
      ]);

      // Calculate quota
      const batchesEarned = 1 + Math.floor(totalUsed / Math.floor(BATCH_SIZE * UNLOCK_THRESHOLD));
      const maxAllowed = batchesEarned * BATCH_SIZE;
      const canCreate = totalCreated < maxAllowed;
      const remaining = maxAllowed - totalCreated;
      const usedTowardNext =
        totalUsed - Math.floor(BATCH_SIZE * UNLOCK_THRESHOLD) * (batchesEarned - 1);

      return {
        totalCreated,
        totalUsed,
        maxAllowed,
        remaining: Math.max(0, remaining),
        canCreate,
        usedTowardNext: Math.max(0, usedTowardNext),
        neededForNext: Math.floor(BATCH_SIZE * UNLOCK_THRESHOLD),
      };
    });

    // List my invites
    authed.get("/api/invites", async (request) => {
      const userId = request.user.userId;
      const invites = await prisma.invite.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          code: true,
          usedById: true,
          usedAt: true,
          createdAt: true,
          usedBy: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        invites: invites.map((inv) => ({
          id: inv.id,
          code: inv.code,
          used: !!inv.usedById,
          usedBy: inv.usedBy?.username || null,
          usedAt: inv.usedAt,
          createdAt: inv.createdAt,
        })),
      };
    });

    // Generate new invite
    authed.post("/api/invites", async (request, reply) => {
      const userId = request.user.userId;

      const [totalCreated, totalUsed] = await Promise.all([
        prisma.invite.count({ where: { creatorId: userId } }),
        prisma.invite.count({ where: { creatorId: userId, usedById: { not: null } } }),
      ]);

      const batchesEarned = 1 + Math.floor(totalUsed / Math.floor(BATCH_SIZE * UNLOCK_THRESHOLD));
      const maxAllowed = batchesEarned * BATCH_SIZE;

      if (totalCreated >= maxAllowed) {
        const needed = Math.floor(BATCH_SIZE * UNLOCK_THRESHOLD) * batchesEarned - totalUsed;
        return reply.status(403).send({
          error: `Invite limit reached. Need ${needed} more used invites to unlock next batch.`,
        });
      }

      const code = randomUUID();
      const invite = await prisma.invite.create({
        data: { code, creatorId: userId },
      });

      return { code: invite.code };
    });
  });
}
