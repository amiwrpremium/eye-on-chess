import Redis from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ONLINE_TTL = 30; // seconds

/**
 * Shared Redis client instance with reconnect strategy.
 * - Retries individual commands up to 3 times before throwing.
 * - Reconnects with exponential backoff (200ms → 5s cap).
 * - Gives up reconnecting after 10 failed attempts.
 * - Reconnects on READONLY errors (Redis failover).
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error({ attempts: times }, "redis: giving up reconnecting");
      return null;
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn({ delay, attempt: times }, "redis: reconnecting");
    return delay;
  },
  reconnectOnError(err) {
    return err.message.includes("READONLY");
  },
});

function onlineKey(userId: string) {
  return `online:${userId}`;
}

/**
 * Mark a user as online with a TTL-based expiry.
 * @param userId - The user to mark online.
 */
export async function setOnline(userId: string) {
  await redis.setex(onlineKey(userId), ONLINE_TTL, "1");
}

/**
 * Remove a user's online status immediately.
 * @param userId - The user to mark offline.
 */
export async function setOffline(userId: string) {
  await redis.del(onlineKey(userId));
}

/**
 * Check whether a user is currently online.
 * @param userId - The user to check.
 * @returns True if the user is online.
 */
export async function isOnline(userId: string): Promise<boolean> {
  return (await redis.exists(onlineKey(userId))) === 1;
}

/**
 * Enforce a rate limit of 5 reactions per 10 seconds per user per game.
 * @param gameId - The game identifier.
 * @param userId - The user sending the reaction.
 * @returns True if the reaction is within the rate limit.
 */
export async function checkReactionRateLimit(gameId: string, userId: string): Promise<boolean> {
  const key = `reaction:limit:${gameId}:${userId}`;
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 10);
  const results = await pipeline.exec();
  const count = (results?.[0]?.[1] as number) || 0;
  return count <= 5;
}

/**
 * Check online status for multiple users in a single pipeline call.
 * @param userIds - Array of user IDs to check.
 * @returns A map of user ID to online status.
 */
export async function bulkIsOnline(userIds: string[]): Promise<Record<string, boolean>> {
  if (userIds.length === 0) return {};

  const pipeline = redis.pipeline();
  for (const id of userIds) {
    pipeline.exists(onlineKey(id));
  }
  const results = await pipeline.exec();

  const map: Record<string, boolean> = {};
  userIds.forEach((id, i) => {
    map[id] = results?.[i]?.[1] === 1;
  });
  return map;
}
