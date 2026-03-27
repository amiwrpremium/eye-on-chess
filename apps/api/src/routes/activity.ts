import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { authMiddleware } from "../middleware/auth.js";
import type { ActivityEvent } from "@eyeonchess/chess";

/** Register activity feed routes (list recent activity events). */
export async function activityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/feed", async (request) => {
    const userId = request.user.userId;
    const cacheKey = `activity:${userId}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { events: JSON.parse(cached) };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events: ActivityEvent[] = [];

    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );
    const relevantUserIds = [userId, ...friendIds];

    // Recent completed games involving relevant users
    const games = await prisma.game.findMany({
      where: {
        status: "COMPLETED",
        endedAt: { gte: since },
        OR: [{ whiteId: { in: relevantUserIds } }, { blackId: { in: relevantUserIds } }],
      },
      select: {
        id: true,
        result: true,
        timeControl: true,
        isVsBot: true,
        botElo: true,
        endedAt: true,
        whiteId: true,
        blackId: true,
        white: { select: { username: true } },
        black: { select: { username: true } },
      },
      orderBy: { endedAt: "desc" },
      take: 15,
    });

    for (const g of games) {
      const whiteName = g.white?.username || (g.isVsBot ? `Bot (${g.botElo})` : "?");
      const blackName = g.black?.username || (g.isVsBot ? `Bot (${g.botElo})` : "?");
      const tc = g.timeControl;
      const ts = g.endedAt?.toISOString() || new Date().toISOString();
      const usernames = [whiteName, blackName].filter((n) => n !== "?");

      if (g.result === "WHITE_WIN") {
        events.push({
          type: "game_won",
          message: `${whiteName} beat ${blackName} (${tc})`,
          timestamp: ts,
          link: `/game/${g.id}/analysis`,
          usernames,
        });
      } else if (g.result === "BLACK_WIN") {
        events.push({
          type: "game_won",
          message: `${blackName} beat ${whiteName} (${tc})`,
          timestamp: ts,
          link: `/game/${g.id}/analysis`,
          usernames,
        });
      } else if (g.result === "DRAW") {
        events.push({
          type: "game_draw",
          message: `${whiteName} drew with ${blackName} (${tc})`,
          timestamp: ts,
          link: `/game/${g.id}/analysis`,
          usernames,
        });
      }
    }

    // Recent analyses
    const analyses = await prisma.gameAnalysis.findMany({
      where: {
        createdAt: { gte: since },
        game: {
          OR: [{ whiteId: { in: relevantUserIds } }, { blackId: { in: relevantUserIds } }],
        },
      },
      select: {
        createdAt: true,
        game: {
          select: {
            id: true,
            white: { select: { username: true } },
            black: { select: { username: true } },
            isVsBot: true,
            botElo: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const a of analyses) {
      const whiteName = a.game.white?.username || (a.game.isVsBot ? `Bot (${a.game.botElo})` : "?");
      const blackName = a.game.black?.username || (a.game.isVsBot ? `Bot (${a.game.botElo})` : "?");
      events.push({
        type: "game_analyzed",
        message: `Game analyzed: ${whiteName} vs ${blackName}`,
        timestamp: a.createdAt.toISOString(),
        link: `/game/${a.game.id}/analysis`,
        usernames: [whiteName, blackName].filter((n) => n !== "?"),
      });
    }

    // Recent friendships
    const newFriends = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        updatedAt: { gte: since },
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        updatedAt: true,
        requester: { select: { username: true } },
        addressee: { select: { username: true } },
        requesterId: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    for (const f of newFriends) {
      const otherName = f.requesterId === userId ? f.addressee.username : f.requester.username;
      events.push({
        type: "friend_added",
        message: `You are now friends with ${otherName}`,
        timestamp: f.updatedAt.toISOString(),
        link: `/profile/${otherName}`,
        usernames: [otherName],
      });
    }

    // Sort by timestamp descending, limit to 20
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limited = events.slice(0, 20);

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(limited));

    return { events: limited };
  });
}
