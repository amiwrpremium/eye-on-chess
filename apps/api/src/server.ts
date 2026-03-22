import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import metricsPlugin from "fastify-metrics";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { friendRoutes } from "./routes/friends.js";
import { gameRoutes } from "./routes/games.js";
import { analysisRoutes } from "./routes/analysis.js";
import { adminRoutes } from "./routes/admin.js";
import { collectionRoutes } from "./routes/collections.js";
import { inviteRoutes } from "./routes/invites.js";
import { noteRoutes } from "./routes/notes.js";
import { setupSocket } from "./lib/socket.js";
import { setupGameSocket } from "./lib/gameSocket.js";
import { getSiteSettings } from "./lib/settings.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { registerRequestLogger } from "./middleware/requestLogger.js";
import { initRateLimitConfig, getRouteLimit } from "./lib/rateLimit.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    trustProxy: true,
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(cookie);

  // Rate limiting (YAML config with hot-reload)
  const rateLimitCfg = initRateLimitConfig();
  await fastify.register(rateLimit, {
    max: rateLimitCfg.global.max,
    timeWindow: rateLimitCfg.global.timeWindow,
    keyGenerator: (request) => request.ip,
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

  // Prometheus metrics at /metrics
  await fastify.register(metricsPlugin, {
    endpoint: "/metrics",
    defaultMetrics: { enabled: true },
    routeMetrics: { enabled: true },
  });

  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(friendRoutes);
  await fastify.register(gameRoutes);
  await fastify.register(analysisRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(collectionRoutes);
  await fastify.register(inviteRoutes);
  await fastify.register(noteRoutes);

  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  fastify.get("/api/settings", async () => {
    const settings = await getSiteSettings();
    return {
      siteName: settings.siteName,
      siteUrl: process.env.SITE_URL || "http://localhost",
      registrationOpen: settings.registrationOpen,
    };
  });

  // Custom metrics endpoint with app-specific gauges
  fastify.get("/api/metrics/app", async () => {
    const [totalUsers, activeGames, analysisQueue] = await Promise.all([
      prisma.user.count(),
      prisma.game.count({ where: { status: "ACTIVE" } }),
      redis.llen("analysis:queue"),
    ]);
    return { totalUsers, activeGames, analysisQueue };
  });

  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });

    const httpServer = fastify.server;
    const io = setupSocket(httpServer);
    setupGameSocket(io);
    fastify.log.info("Socket.io attached with game events");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
