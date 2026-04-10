import { redis } from "@/core/cache/redis";

let redisConnectPromise: Promise<unknown> | null = null;

async function getRedisClient() {
  if (process.env.REDIS_ENABLED === "false") {
    return null;
  }
  if (redis.isOpen) {
    return redis;
  }
  if (!redisConnectPromise) {
    redisConnectPromise = redis.connect();
  }
  try {
    await redisConnectPromise;
    return redis.isOpen ? redis : null;
  } catch {
    redisConnectPromise = null;
    return null;
  }
}

export async function getVersion(key: string) {
  const client = await getRedisClient();
  if (!client) {
    return 1;
  }
  try {
    const val = await client.get(`v:${key}`);
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  } catch {
    return 1;
  }
}

export async function bumpVersion(key: string) {
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.incr(`v:${key}`);
  } catch {
    // ignore
  }
}
