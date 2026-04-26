import { safeRedisGet, safeRedisSet } from "@/core/cache/redis";
export async function getCache(key) {
    const data = await safeRedisGet(key);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
export async function setCache(key, value, ttl = 60) {
    await safeRedisSet(key, JSON.stringify(value), ttl);
}
