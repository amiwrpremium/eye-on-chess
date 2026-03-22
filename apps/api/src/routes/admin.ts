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

/** Register admin routes (user management, site settings, CSRF tokens). */
export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require auth + admin role + rate limiting
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", adminMiddleware);
  app.addHook("preHandler", adminRateLimit);
  app.addHook("preHandler", csrfProtection);

  // ── CSRF Token ────────────────────────────────────────
  app.get("/api/admin/csrf", async (request, reply) => {
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
  app.get("/api/admin/dashboard", async () => {
    const [
      totalUsers,
      activeUsers,
      totalGames,
      activeGames,
      completedGames,
      gamesToday,
      queueDepth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.game.count(),
      prisma.game.count({ where: { status: "ACTIVE" } }),
      prisma.game.count({ where: { status: "COMPLETED" } }),
      prisma.game.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      redis.llen("analysis:queue"),
    ]);

    const settings = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
    });

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalGames,
        activeGames,
        completedGames,
        gamesToday,
        analysisQueueDepth: queueDepth,
      },
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
  }>("/api/admin/users", async (request) => {
    const page = Math.max(1, parseInt(request.query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20")));
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
        skip: (page - 1) * limit,
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
  }>("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params;
    const { active, verified, role } = request.body;
    const adminId = request.user.userId;

    if (id === adminId && role && role !== "ADMIN") {
      return reply.status(400).send({ error: "Cannot demote yourself" });
    }

    if (id === adminId && active === false) {
      return reply.status(400).send({ error: "Cannot deactivate yourself" });
    }

    // Prevent removing last admin
    if (role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === "ADMIN" && adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot remove the last admin" });
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

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.user.userId;

    if (id === adminId) {
      return reply.status(400).send({ error: "Cannot delete yourself" });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, username: true },
    });

    if (!target) {
      return reply.status(404).send({ error: "User not found" });
    }

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot delete the last admin" });
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
  }>("/api/admin/users", async (request, reply) => {
    const adminId = request.user.userId;
    const { email, username, password, role, verified } = request.body;

    if (!email || !username || !password) {
      return reply.status(400).send({ error: "Email, username, and password are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return reply.status(409).send({ error: "Email already in use" });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return reply.status(409).send({ error: "Username already taken" });
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
  }>("/api/admin/games", async (request) => {
    const page = Math.max(1, parseInt(request.query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20")));
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  app.delete<{ Params: { id: string } }>("/api/admin/games/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.user.userId;

    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!game) {
      return reply.status(404).send({ error: "Game not found" });
    }

    await prisma.game.delete({ where: { id } });

    await auditLog(adminId, "game.delete", "game", id, null, request.ip);

    return { success: true };
  });

  // ── Site Settings ─────────────────────────────────────
  app.get("/api/admin/settings", async () => {
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
  }>("/api/admin/settings", async (request) => {
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
  }>("/api/admin/audit-log", async (request) => {
    const page = Math.max(1, parseInt(request.query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "50")));
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}
