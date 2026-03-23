import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import metricsPlugin from "fastify-metrics";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { friendRoutes } from "./routes/friends.js";
import { gameRoutes } from "./routes/games.js";
import { botRoutes } from "./routes/bots.js";
import { analysisRoutes } from "./routes/analysis.js";
import { adminRoutes } from "./routes/admin.js";
import { collectionRoutes } from "./routes/collections.js";
import { inviteRoutes } from "./routes/invites.js";
import { noteRoutes } from "./routes/notes.js";
import { activityRoutes } from "./routes/activity.js";
import { statsRoutes } from "./routes/stats.js";
import { setupSocket } from "./lib/socket.js";
import { setupGameSocket } from "./lib/gameSocket.js";
import { getSiteSettings } from "./lib/settings.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { registerRequestLogger } from "./middleware/requestLogger.js";
import { registerEtag } from "./middleware/etag.js";
import { checkHealth } from "./lib/healthCheck.js";
import { registerShutdown } from "./lib/shutdown.js";
import { updateMetrics } from "./lib/metrics.js";
import { enterRequestContext } from "./lib/requestContext.js";
import { initRateLimitConfig, getRouteLimit } from "./lib/rateLimit.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    trustProxy: true,
  });

  // Zod request validation
  fastify.setValidatorCompiler(validatorCompiler);

  // Structured error responses with error codes
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      const messages = error.validation.map((v) => v.message).join("; ");
      return reply
        .status(400)
        .send({ code: "VALIDATION_FAILED", error: messages || "Validation failed" });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ code: "UNAUTHORIZED", error: error.message });
    }
    request.log.error(error);
    reply.status(500).send({ code: "INTERNAL_ERROR", error: "Internal server error" });
  });

  // CORS — whitelist based on SITE_URL, permissive in development
  const isProduction = process.env.NODE_ENV === "production";
  const siteUrl = process.env.SITE_URL || "http://localhost";
  const allowedOrigins = isProduction
    ? [siteUrl]
    : [siteUrl, "http://localhost", "http://localhost:3000", "http://localhost:3001"];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // In dev, also allow any localhost variant
      if (!isProduction && origin.startsWith("http://localhost")) return cb(null, true);
      cb(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
  });

  await fastify.register(cookie);
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(compress, { global: true });

  // OpenAPI docs at /docs
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "EyeOnChess API",
        description: "Self-hostable chess platform API",
        version: "1.0.0",
      },
      tags: [
        { name: "auth", description: "Authentication" },
        { name: "games", description: "Game management" },
        { name: "friends", description: "Friend system" },
        { name: "bots", description: "Bot personalities" },
        { name: "analysis", description: "Game analysis" },
        { name: "collections", description: "Game collections" },
        { name: "invites", description: "Invite system" },
        { name: "stats", description: "Personal stats" },
        { name: "activity", description: "Activity feed" },
        { name: "notes", description: "Game notes" },
        { name: "admin", description: "Admin panel" },
      ],
    },
  });
  await fastify.register(swaggerUI, { routePrefix: "/docs" });

  // Rate limiting (YAML config with hot-reload)
  const rateLimitCfg = initRateLimitConfig();
  await fastify.register(rateLimit, {
    max: rateLimitCfg.global.max,
    timeWindow: rateLimitCfg.global.timeWindow,
    keyGenerator: (request) => request.user?.userId || request.ip,
    addHeadersOnExceeding: { "x-ratelimit-limit": true, "x-ratelimit-remaining": true },
    addHeaders: { "x-ratelimit-limit": true, "x-ratelimit-remaining": true, "retry-after": true },
  });

  // Per-route rate limit override hook
  fastify.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url;

    routeOptions.config = {
      ...((routeOptions.config as Record<string, unknown>) || {}),
      rateLimit: (() => {
        const limit = getRouteLimit(url);
        if (limit !== rateLimitCfg.global) {
          return { max: limit.max, timeWindow: limit.timeWindow };
        }
        return undefined;
      })(),
    };
  });

  // Request logging (redacts sensitive fields)
  registerRequestLogger(fastify);

  // ETag headers for conditional GET requests
  registerEtag(fastify);

  // Propagate request ID via AsyncLocalStorage for end-to-end tracing
  fastify.addHook("onRequest", async (request) => {
    enterRequestContext(String(request.id));
  });

  // Prometheus metrics at /metrics
  await fastify.register(metricsPlugin, {
    endpoint: "/metrics",
    defaultMetrics: { enabled: true },
    routeMetrics: { enabled: true },
  });

  // ── API v1 routes ───────────────────────────────────
  await fastify.register(
    async (v1) => {
      await v1.register(botRoutes);
      await v1.register(authRoutes);
      await v1.register(userRoutes);
      await v1.register(friendRoutes);
      await v1.register(gameRoutes);
      await v1.register(analysisRoutes);
      await v1.register(adminRoutes);
      await v1.register(collectionRoutes);
      await v1.register(inviteRoutes);
      await v1.register(noteRoutes);
      await v1.register(activityRoutes);
      await v1.register(statsRoutes);

      v1.get("/settings", async () => {
        const settings = await getSiteSettings();
        return {
          siteName: settings.siteName,
          siteUrl: process.env.SITE_URL || "http://localhost",
          registrationOpen: settings.registrationOpen,
        };
      });

      // Custom metrics endpoint with app-specific gauges
      v1.get("/metrics/app", async () => {
        const [totalUsers, activeGames, analysisQueue] = await Promise.all([
          prisma.user.count(),
          prisma.game.count({ where: { status: "ACTIVE" } }),
          redis.llen("analysis:queue"),
        ]);
        return { totalUsers, activeGames, analysisQueue };
      });
    },
    { prefix: "/api/v1" }
  );

  // ── Backward-compat redirect: /api/* → /api/v1/* ──
  fastify.all("/api/*", async (request, reply) => {
    const rest = (request.params as { "*": string })["*"];
    reply.redirect(301, `/api/v1/${rest}`);
  });

  fastify.get("/health", async (_request, reply) => {
    const health = await checkHealth();
    reply.code(health.status === "ok" ? 200 : 503);
    return health;
  });

  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });

    const httpServer = fastify.server;
    const io = setupSocket(httpServer);
    setupGameSocket(io);
    fastify.log.info("Socket.io attached with game events");

    registerShutdown(fastify, io, fastify.log);

    // Update custom Prometheus metrics every 15 seconds
    setInterval(updateMetrics, 15_000);
    updateMetrics();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
