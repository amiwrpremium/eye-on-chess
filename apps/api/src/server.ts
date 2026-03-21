import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { friendRoutes } from "./routes/friends.js";
import { gameRoutes } from "./routes/games.js";
import { analysisRoutes } from "./routes/analysis.js";
import { adminRoutes } from "./routes/admin.js";
import { setupSocket } from "./lib/socket.js";
import { setupGameSocket } from "./lib/gameSocket.js";
import { getSiteSettings } from "./lib/settings.js";
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

  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(friendRoutes);
  await fastify.register(gameRoutes);
  await fastify.register(analysisRoutes);
  await fastify.register(adminRoutes);

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
