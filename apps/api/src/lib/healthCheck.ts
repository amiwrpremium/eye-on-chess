import { prisma } from "./prisma.js";
import { redis } from "./redis.js";

interface ServiceStatus {
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

interface HealthResult {
  status: "ok" | "degraded";
  timestamp: string;
  services: {
    postgres: ServiceStatus;
    redis: ServiceStatus;
  };
}

/**
 * Check the health of Postgres and Redis by pinging each service.
 * Returns individual status with latency for each service.
 *
 * @returns Health result with overall status and per-service details.
 */
export async function checkHealth(): Promise<HealthResult> {
  const timestamp = new Date().toISOString();

  // Check Postgres
  let postgres: ServiceStatus;
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    postgres = { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    postgres = {
      status: "error",
      latencyMs: 0,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  // Check Redis
  let redisStatus: ServiceStatus;
  try {
    const start = Date.now();
    await redis.ping();
    redisStatus = { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    redisStatus = {
      status: "error",
      latencyMs: 0,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  const allOk = postgres.status === "ok" && redisStatus.status === "ok";

  return {
    status: allOk ? "ok" : "degraded",
    timestamp,
    services: {
      postgres,
      redis: redisStatus,
    },
  };
}
