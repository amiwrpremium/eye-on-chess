import { FastifyInstance } from "fastify";
import { BOT_PERSONALITIES } from "@eyeonchess/chess";

/**
 * Register the public bot listing endpoint.
 * No authentication is required for this route.
 */
export async function botRoutes(app: FastifyInstance) {
  app.get("/api/bots", async () => {
    return { bots: BOT_PERSONALITIES };
  });
}
