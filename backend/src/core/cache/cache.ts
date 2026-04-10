import { safeRedisGet, safeRedisSet } from "@/core/cache/redis";

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const data = await safeRedisGet(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttl = 60) {
  await safeRedisSet(key, JSON.stringify(value), ttl);
}
