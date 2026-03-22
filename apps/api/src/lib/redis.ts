import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ONLINE_TTL = 30; // seconds

export const redis = new Redis(REDIS_URL);

function onlineKey(userId: string) {
  return `online:${userId}`;
}

export async function setOnline(userId: string) {
  await redis.setex(onlineKey(userId), ONLINE_TTL, "1");
}

export async function setOffline(userId: string) {
  await redis.del(onlineKey(userId));
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await redis.exists(onlineKey(userId))) === 1;
}

export async function checkReactionRateLimit(gameId: string, userId: string): Promise<boolean> {
  const key = `reaction:limit:${gameId}:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 10);
  }
  return count <= 5;
}

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
