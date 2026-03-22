import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { authMiddleware } from "../middleware/auth.js";
import { lookupOpening } from "../lib/eco.js";

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
    const record = { wins: 0, losses: 0, draws: 0 };
    const vsHuman = { wins: 0, losses: 0, draws: 0 };
    const vsBot = { wins: 0, losses: 0, draws: 0 };

    for (const g of games) {
      const isWhite = g.whiteId === userId;
      const won = (isWhite && g.result === "WHITE_WIN") || (!isWhite && g.result === "BLACK_WIN");
      const lost = (isWhite && g.result === "BLACK_WIN") || (!isWhite && g.result === "WHITE_WIN");
      const drew = g.result === "DRAW";
      const target = g.isVsBot ? vsBot : vsHuman;

      if (won) {
        record.wins++;
        target.wins++;
      } else if (lost) {
        record.losses++;
        target.losses++;
      } else if (drew) {
        record.draws++;
        target.draws++;
      }
    }

    // ── Rating History ──────────────────────────────────
    // Replay Elo forward from 1200
    const K = 32;
    let rating = 1200;
    const ratingHistory: { date: string; rating: number }[] = [
      {
        date:
          games[0]?.createdAt.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        rating: 1200,
      },
    ];

    for (const g of games) {
      if (g.isVsBot) continue; // Bot games don't affect rating
      const isWhite = g.whiteId === userId;
      const opponentRating = isWhite ? g.black?.rating || 1200 : g.white?.rating || 1200;
      const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
      const actual =
        (isWhite && g.result === "WHITE_WIN") || (!isWhite && g.result === "BLACK_WIN")
          ? 1
          : g.result === "DRAW"
            ? 0.5
            : 0;
      rating = Math.round(rating + K * (actual - expected));
      ratingHistory.push({
        date: g.createdAt.toISOString().split("T")[0],
        rating,
      });
    }

    // ── Openings ────────────────────────────────────────
    const openingCounts: Record<
      string,
      { name: string; eco: string; wins: number; losses: number; draws: number }
    > = {};

    for (const g of games) {
      const sans = g.moves.map((m) => m.san);
      const opening = lookupOpening(sans);
      if (!opening) continue;
      const key = opening.eco;
      if (!openingCounts[key]) {
        openingCounts[key] = { name: opening.name, eco: opening.eco, wins: 0, losses: 0, draws: 0 };
      }
      const isWhite = g.whiteId === userId;
      const won = (isWhite && g.result === "WHITE_WIN") || (!isWhite && g.result === "BLACK_WIN");
      const lost = (isWhite && g.result === "BLACK_WIN") || (!isWhite && g.result === "WHITE_WIN");
      if (won) openingCounts[key].wins++;
      else if (lost) openingCounts[key].losses++;
      else openingCounts[key].draws++;
    }

    const openings = Object.values(openingCounts)
      .map((o) => ({ ...o, count: o.wins + o.losses + o.draws }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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
    const currentStreak = { type: "none" as "win" | "loss" | "none", count: 0 };
    let bestWinStreak = 0;
    let tempWinStreak = 0;

    for (let i = games.length - 1; i >= 0; i--) {
      const g = games[i];
      const isWhite = g.whiteId === userId;
      const won = (isWhite && g.result === "WHITE_WIN") || (!isWhite && g.result === "BLACK_WIN");
      const lost = (isWhite && g.result === "BLACK_WIN") || (!isWhite && g.result === "WHITE_WIN");

      if (i === games.length - 1) {
        currentStreak.type = won ? "win" : lost ? "loss" : "none";
        currentStreak.count = 1;
      } else if ((won && currentStreak.type === "win") || (lost && currentStreak.type === "loss")) {
        currentStreak.count++;
      } else {
        break;
      }
    }

    // Best win streak (forward scan)
    for (const g of games) {
      const isWhite = g.whiteId === userId;
      const won = (isWhite && g.result === "WHITE_WIN") || (!isWhite && g.result === "BLACK_WIN");
      if (won) {
        tempWinStreak++;
        bestWinStreak = Math.max(bestWinStreak, tempWinStreak);
      } else {
        tempWinStreak = 0;
      }
    }

    // ── Activity (last 30 days) ─────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activityMap: Record<string, number> = {};
    for (const g of games) {
      if (g.createdAt < thirtyDaysAgo) continue;
      const day = g.createdAt.toISOString().split("T")[0];
      activityMap[day] = (activityMap[day] || 0) + 1;
    }
    const activity = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      rating: { current: user?.rating || 1200, history: ratingHistory },
      record: { ...record, vsHuman, vsBot },
      openings,
      accuracy: {
        average: avgAccuracy,
        best: bestAccuracy,
        worst: worstAccuracy,
        gamesAnalyzed: analyses.length,
      },
      streaks: { current: currentStreak, bestWin: bestWinStreak },
      activity,
      totalGames: games.length,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  });
}
