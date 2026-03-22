import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  computeRecord,
  computeRatingHistory,
  computeOpeningStats,
  computeStreaks,
  computeActivity,
} from "../lib/statsCompute.js";

/** Register stats routes (record, rating history, openings, streaks, activity). */
export async function statsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/api/stats", async (request) => {
    const userId = request.user.userId;
    const cacheKey = `stats:${userId}`;

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rating: true },
    });

    // All completed games for user
    const games = await prisma.game.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ whiteId: userId }, { blackId: userId }],
      },
      select: {
        id: true,
        result: true,
        whiteId: true,
        blackId: true,
        isVsBot: true,
        createdAt: true,
        white: { select: { rating: true } },
        black: { select: { rating: true } },
        moves: { orderBy: { ply: "asc" }, select: { san: true }, take: 10 },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Record ──────────────────────────────────────────
    const record = computeRecord(games, userId);

    // ── Rating History ──────────────────────────────────
    const ratingHistory = computeRatingHistory(games, userId);

    // ── Openings ────────────────────────────────────────
    const openings = computeOpeningStats(games, userId);

    // ── Accuracy ────────────────────────────────────────
    const analyses = await prisma.gameAnalysis.findMany({
      where: {
        game: { OR: [{ whiteId: userId }, { blackId: userId }] },
        whiteAccuracy: { not: null },
      },
      select: {
        gameId: true,
        whiteAccuracy: true,
        blackAccuracy: true,
        game: { select: { whiteId: true } },
      },
    });

    let avgAccuracy: number | null = null;
    let bestAccuracy: { value: number; gameId: string } | null = null;
    let worstAccuracy: { value: number; gameId: string } | null = null;

    if (analyses.length > 0) {
      let sum = 0;
      for (const a of analyses) {
        const acc = a.game.whiteId === userId ? a.whiteAccuracy! : a.blackAccuracy!;
        sum += acc;
        if (!bestAccuracy || acc > bestAccuracy.value) {
          bestAccuracy = { value: acc, gameId: a.gameId };
        }
        if (!worstAccuracy || acc < worstAccuracy.value) {
          worstAccuracy = { value: acc, gameId: a.gameId };
        }
      }
      avgAccuracy = Math.round((sum / analyses.length) * 10) / 10;
    }

    // ── Streaks ─────────────────────────────────────────
    const streaks = computeStreaks(games, userId);

    // ── Activity (last 30 days) ─────────────────────────
    const activity = computeActivity(games);

    const result = {
      rating: { current: user?.rating || 1200, history: ratingHistory },
      record,
      openings,
      accuracy: {
        average: avgAccuracy,
        best: bestAccuracy,
        worst: worstAccuracy,
        gamesAnalyzed: analyses.length,
      },
      streaks,
      activity,
      totalGames: games.length,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  });
}
