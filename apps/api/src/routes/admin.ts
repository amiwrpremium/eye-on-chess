import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  adminMiddleware,
  adminRateLimit,
  csrfProtection,
  generateCsrfToken,
  auditLog,
  sanitizeString,
} from "../middleware/admin.js";
import { z } from "zod";
import {
  adminCreateUserBodySchema,
  createBotBodySchema,
  updateBotBodySchema,
} from "../lib/schemas.js";
import { parsePagination } from "../lib/pagination.js";
import {
  apiError,
  ADMIN_SELF_DEMOTE,
  ADMIN_SELF_DEACTIVATE,
  ADMIN_LAST_ADMIN,
  ADMIN_SELF_DELETE,
  ADMIN_USER_NOT_FOUND,
  ADMIN_EMAIL_EXISTS,
  ADMIN_USERNAME_EXISTS,
  ADMIN_GAME_NOT_FOUND,
  ADMIN_BOT_NOT_FOUND,
  ADMIN_BOT_ID_EXISTS,
} from "../lib/errorCodes.js";
import { loadBotsFromYaml, type BotDef } from "../../prisma/seed-bots.js";

/** Register admin routes (user management, site settings, CSRF tokens). */
export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require auth + admin role + rate limiting
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", adminMiddleware);
  app.addHook("preHandler", adminRateLimit);
  app.addHook("preHandler", csrfProtection);

  // ── CSRF Token ────────────────────────────────────────
  app.get("/admin/csrf", async (request, reply) => {
    const token = generateCsrfToken();
    reply.setCookie("csrf_token", token, {
      httpOnly: false, // Must be readable by JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600_000,
    });
    return { token };
  });

  // ── Dashboard ─────────────────────────────────────────
  app.get("/admin/dashboard", async () => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsersWeek,
      totalGames,
      activeGames,
      completedGames,
      abortedGames,
      gamesToday,
      gamesWeek,
      gamesMonth,
      botGames,
      queueDepth,
      resultDist,
      timeControlDist,
      recentAudit,
      topBotGames,
      enabledBots,
      totalBots,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { verified: true } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.game.count(),
      prisma.game.count({ where: { status: "ACTIVE" } }),
      prisma.game.count({ where: { status: "COMPLETED" } }),
      prisma.game.count({ where: { status: "ABORTED" } }),
      prisma.game.count({ where: { createdAt: { gte: today } } }),
      prisma.game.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.game.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.game.count({ where: { isVsBot: true } }),
      redis.llen("analysis:queue"),
      prisma.game.groupBy({
        by: ["result"],
        where: { status: "COMPLETED", result: { not: null } },
        _count: true,
      }),
      prisma.game.groupBy({ by: ["timeControl"], _count: true }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { username: true } } },
      }),
      prisma.game.groupBy({
        by: ["botElo"],
        where: { isVsBot: true, botElo: { not: null } },
        _count: true,
        orderBy: { _count: { botElo: "desc" } },
        take: 5,
      }),
      prisma.botProfile.count({ where: { enabled: true } }),
      prisma.botProfile.count(),
    ]);

    // Map top bot Elos to bot names
    const topBotElos = topBotGames.map((g) => g.botElo as number);
    const botProfiles =
      topBotElos.length > 0
        ? await prisma.botProfile.findMany({
            where: { elo: { in: topBotElos } },
            select: { name: true, avatar: true, elo: true },
          })
        : [];
    const botByElo = new Map(botProfiles.map((b) => [b.elo, b]));
    const topBots = topBotGames.map((g) => {
      const bot = botByElo.get(g.botElo as number);
      return {
        name: bot?.name || `Bot ${g.botElo}`,
        avatar: bot?.avatar || "",
        elo: g.botElo,
        games: g._count,
      };
    });

    // Online users count from Redis
    let onlineCount = 0;
    try {
      const keys = await redis.keys("online:*");
      onlineCount = keys.length;
    } catch {
      // Redis might not have any keys
    }

    const settings = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
    });

    return {
      stats: {
        totalUsers,
        activeUsers,
        verifiedUsers,
        newUsersWeek,
        totalGames,
        activeGames,
        completedGames,
        abortedGames,
        gamesToday,
        gamesWeek,
        gamesMonth,
        botGames,
        humanGames: totalGames - botGames,
        analysisQueueDepth: queueDepth,
        onlineCount,
        enabledBots,
        totalBots,
      },
      resultDistribution: resultDist.map((r) => ({
        result: r.result,
        count: r._count,
      })),
      timeControlDistribution: timeControlDist.map((t) => ({
        timeControl: t.timeControl,
        count: t._count,
      })),
      topBots,
      recentAudit: recentAudit.map((a) => ({
        action: a.action,
        admin: a.admin.username,
        createdAt: a.createdAt,
      })),
      settings: settings || null,
    };
  });

  // ── Users ─────────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      sort?: string;
      order?: string;
    };
  }>("/admin/users", async (request) => {
    const { page, limit, skip } = parsePagination(request.query, { maxLimit: 100 });
    const search = request.query.search?.trim();
    const sort = request.query.sort || "createdAt";
    const order = request.query.order === "asc" ? "asc" : "desc";

    const validSorts = ["createdAt", "username", "email", "rating", "role"];
    const orderBy = validSorts.includes(sort) ? { [sort]: order } : { createdAt: "desc" as const };

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          rating: true,
          role: true,
          active: true,
          verified: true,
          createdAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  app.patch<{
    Params: { id: string };
    Body: { active?: boolean; verified?: boolean; role?: string };
  }>("/admin/users/:id", async (request, reply) => {
    const { id } = request.params;
    const { active, verified, role } = request.body;
    const adminId = request.user.userId;

    if (id === adminId && role && role !== "ADMIN") {
      return apiError(reply, 400, ADMIN_SELF_DEMOTE, "Cannot demote yourself");
    }

    if (id === adminId && active === false) {
      return apiError(reply, 400, ADMIN_SELF_DEACTIVATE, "Cannot deactivate yourself");
    }

    // Prevent removing last admin
    if (role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === "ADMIN" && adminCount <= 1) {
        return apiError(reply, 400, ADMIN_LAST_ADMIN, "Cannot remove the last admin");
      }
    }

    const data: Record<string, unknown> = {};
    if (active !== undefined) data.active = active;
    if (verified !== undefined) data.verified = verified;
    if (role === "USER" || role === "ADMIN") data.role = role;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        active: true,
        verified: true,
      },
    });

    await auditLog(adminId, "user.update", "user", id, data, request.ip);

    return { user };
  });

  app.delete<{ Params: { id: string } }>("/admin/users/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.user.userId;

    if (id === adminId) {
      return apiError(reply, 400, ADMIN_SELF_DELETE, "Cannot delete yourself");
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, username: true },
    });

    if (!target) {
      return apiError(reply, 404, ADMIN_USER_NOT_FOUND, "User not found");
    }

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return apiError(reply, 400, ADMIN_LAST_ADMIN, "Cannot delete the last admin");
      }
    }

    await prisma.user.delete({ where: { id } });

    await auditLog(adminId, "user.delete", "user", id, { username: target.username }, request.ip);

    return { success: true };
  });

  // Create user
  app.post<{
    Body: {
      email: string;
      username: string;
      password: string;
      role?: string;
      verified?: boolean;
    };
  }>("/admin/users", { schema: { body: adminCreateUserBodySchema } }, async (request, reply) => {
    const adminId = request.user.userId;
    const { email, username, password, role, verified } = request.body;

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return apiError(reply, 409, ADMIN_EMAIL_EXISTS, "Email already in use");
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return apiError(reply, 409, ADMIN_USERNAME_EXISTS, "Username already taken");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: sanitizeString(email).toLowerCase(),
        username: sanitizeString(username),
        passwordHash,
        role: role === "ADMIN" ? "ADMIN" : "USER",
        verified: verified ?? true,
        tosAccepted: true,
        tosAcceptedAt: new Date(),
      },
    });

    // Create Favorites collection
    await prisma.collection.create({
      data: { userId: user.id, name: "Favorites" },
    });

    await auditLog(
      adminId,
      "user.create",
      "user",
      user.id,
      { email: user.email, username: user.username, role: user.role },
      request.ip
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        verified: user.verified,
      },
    };
  });

  // ── Games ─────────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
    };
  }>("/admin/games", async (request) => {
    const { page, limit, skip } = parsePagination(request.query, { maxLimit: 100 });
    const statusFilter = request.query.status;
    const search = request.query.search?.trim();

    const where: Record<string, unknown> = {};
    if (statusFilter && ["WAITING", "ACTIVE", "COMPLETED", "ABORTED"].includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (search) {
      where.OR = [
        { white: { username: { contains: search, mode: "insensitive" } } },
        { black: { username: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        select: {
          id: true,
          status: true,
          result: true,
          timeControl: true,
          createdAt: true,
          white: { select: { username: true } },
          black: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  app.delete<{ Params: { id: string } }>("/admin/games/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.user.userId;

    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!game) {
      return apiError(reply, 404, ADMIN_GAME_NOT_FOUND, "Game not found");
    }

    await prisma.game.delete({ where: { id } });

    await auditLog(adminId, "game.delete", "game", id, null, request.ip);

    return { success: true };
  });

  // ── Site Settings ─────────────────────────────────────
  app.get("/admin/settings", async () => {
    let settings = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: {
          siteName: process.env.SITE_NAME || "EyeOnChess",
          registrationOpen: process.env.REGISTRATION_OPEN !== "false",
          maxUsers: parseInt(process.env.MAX_USERS || "0"),
          requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
        },
      });
    }

    return { settings };
  });

  app.put<{
    Body: {
      siteName?: string;
      registrationOpen?: boolean;
      maxUsers?: number;
      requireEmailVerification?: boolean;
    };
  }>("/admin/settings", async (request) => {
    const { siteName, registrationOpen, maxUsers, requireEmailVerification } = request.body;
    const adminId = request.user.userId;

    const data: Record<string, unknown> = {};
    if (siteName !== undefined) data.siteName = sanitizeString(siteName).slice(0, 100);
    if (registrationOpen !== undefined) data.registrationOpen = registrationOpen;
    if (maxUsers !== undefined) data.maxUsers = Math.max(0, Math.min(1000000, maxUsers));
    if (requireEmailVerification !== undefined)
      data.requireEmailVerification = requireEmailVerification;

    const settings = await prisma.siteSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: {
        siteName: (data.siteName as string) || "EyeOnChess",
        registrationOpen: (data.registrationOpen as boolean) ?? true,
        maxUsers: (data.maxUsers as number) ?? 0,
        requireEmailVerification: (data.requireEmailVerification as boolean) ?? false,
      },
    });

    await auditLog(adminId, "settings.update", "settings", "singleton", data, request.ip);

    return { settings };
  });

  // ── Audit Log ─────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      action?: string;
      adminId?: string;
    };
  }>("/admin/audit-log", async (request) => {
    const { page, limit, skip } = parsePagination(request.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    const actionFilter = request.query.action;
    const adminFilter = request.query.adminId;

    const where: Record<string, unknown> = {};
    if (actionFilter) where.action = { contains: actionFilter };
    if (adminFilter) where.adminId = adminFilter;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          admin: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── Bots ────────────────────────────────────────────────

  app.get("/admin/bots", async (request) => {
    const { search, sort, order } = request.query as Record<string, string | undefined>;
    const { page, limit, skip } = parsePagination(
      request.query as { page?: string; limit?: string },
      { maxLimit: 100 }
    );
    const sortField = ["elo", "name", "category", "sortOrder", "createdAt"].includes(sort || "")
      ? sort!
      : "sortOrder";
    const sortOrder = order === "desc" ? "desc" : "asc";

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { botId: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [bots, total] = await Promise.all([
      prisma.botProfile.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.botProfile.count({ where }),
    ]);

    return {
      bots: bots.map((b) => ({
        id: b.id,
        botId: b.botId,
        name: b.name,
        elo: b.elo,
        description: b.description,
        avatar: b.avatar,
        tier: b.tier,
        category: b.category,
        enabled: b.enabled,
        sortOrder: b.sortOrder,
        randomMoveChance: b.randomMoveChance,
        blunderChance: b.blunderChance,
        captureGreed: b.captureGreed,
        aggressionBias: b.aggressionBias,
        maxDepth: b.maxDepth,
        queenEarly: b.queenEarly,
        pawnPusher: b.pawnPusher,
        messages: b.messages ?? null,
        preferredOpenings: b.preferredOpenings ?? null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post("/admin/bots", { schema: { body: createBotBodySchema } }, async (request, reply) => {
    const body = request.body as z.infer<typeof createBotBodySchema>;

    const existing = await prisma.botProfile.findUnique({ where: { botId: body.botId } });
    if (existing) return apiError(reply, 409, ADMIN_BOT_ID_EXISTS, "Bot ID already exists");

    const maxSort = await prisma.botProfile.aggregate({ _max: { sortOrder: true } });
    const bot = await prisma.botProfile.create({
      data: {
        botId: body.botId,
        name: sanitizeString(body.name),
        elo: body.elo,
        description: sanitizeString(body.description),
        avatar: body.avatar,
        tier: body.tier,
        category: body.category,
        enabled: body.enabled ?? true,
        randomMoveChance: body.randomMoveChance ?? 0,
        blunderChance: body.blunderChance ?? 0,
        captureGreed: body.captureGreed ?? 0,
        aggressionBias: body.aggressionBias ?? 0,
        maxDepth: body.maxDepth ?? 3,
        queenEarly: body.queenEarly ?? false,
        pawnPusher: body.pawnPusher ?? false,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        messages: body.messages,
        preferredOpenings: body.preferredOpenings,
      },
    });

    await auditLog(
      request.user.userId,
      "bot.create",
      "BotProfile",
      bot.id,
      { botId: body.botId, name: bot.name, elo: bot.elo },
      request.ip
    );

    return { bot };
  });

  app.patch<{ Params: { id: string } }>(
    "/admin/bots/:id",
    { schema: { body: updateBotBodySchema } },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as z.infer<typeof updateBotBodySchema>;

      const existing = await prisma.botProfile.findUnique({ where: { id } });
      if (!existing) return apiError(reply, 404, ADMIN_BOT_NOT_FOUND, "Bot not found");

      const data: Record<string, unknown> = {};
      const entries = Object.entries(body) as [string, unknown][];
      for (const [key, value] of entries) {
        if (value !== undefined) {
          data[key] = typeof value === "string" ? sanitizeString(value) : value;
        }
      }

      const bot = await prisma.botProfile.update({ where: { id }, data });

      await auditLog(request.user.userId, "bot.update", "BotProfile", id, data, request.ip);

      return { bot };
    }
  );

  app.delete<{ Params: { id: string } }>("/admin/bots/:id", async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.botProfile.findUnique({ where: { id } });
    if (!existing) return apiError(reply, 404, ADMIN_BOT_NOT_FOUND, "Bot not found");

    await prisma.botProfile.delete({ where: { id } });

    await auditLog(
      request.user.userId,
      "bot.delete",
      "BotProfile",
      id,
      { botId: existing.botId, name: existing.name },
      request.ip
    );

    return { success: true };
  });

  app.post("/admin/bots/reseed", async (request) => {
    let bots: BotDef[];
    try {
      bots = loadBotsFromYaml();
    } catch {
      return { error: "Could not load bots.yml" };
    }

    let created = 0;
    let updated = 0;

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const existing = await prisma.botProfile.findUnique({ where: { botId: bot.id } });

      const data = {
        name: bot.name,
        elo: bot.elo,
        description: bot.description,
        avatar: bot.avatar,
        category: bot.category,
        tier: bot.tier,
        randomMoveChance: bot.randomMoveChance,
        blunderChance: bot.blunderChance,
        captureGreed: bot.captureGreed,
        aggressionBias: bot.aggressionBias,
        maxDepth: bot.maxDepth,
        queenEarly: bot.queenEarly,
        pawnPusher: bot.pawnPusher,
        sortOrder: i,
        messages: bot.messages ?? undefined,
        preferredOpenings: bot.preferredOpenings ?? undefined,
      };

      if (existing) {
        await prisma.botProfile.update({ where: { botId: bot.id }, data });
        updated++;
      } else {
        await prisma.botProfile.create({ data: { botId: bot.id, ...data } });
        created++;
      }
    }

    await auditLog(
      request.user.userId,
      "bot.reseed",
      "BotProfile",
      "all",
      { created, updated, total: bots.length },
      request.ip
    );

    return { created, updated };
  });
}
