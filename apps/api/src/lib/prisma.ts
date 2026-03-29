import { PrismaClient } from "@prisma/client";
import { getRequestId } from "./requestContext.js";
import { logger } from "./logger.js";

const SLOW_QUERY_THRESHOLD_MS = 100;

/** Shared Prisma client instance for database access. */
export const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

/**
 * Log slow queries (> 100ms) with request ID for tracing.
 */
prisma.$on("query" as never, (e: { duration: number; query: string; params: string }) => {
  if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
    const reqId = getRequestId();
    logger.warn(
      { duration: e.duration, query: e.query.slice(0, 200), ...(reqId ? { reqId } : {}) },
      "slow query",
    );
  }
});
