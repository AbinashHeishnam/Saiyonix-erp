import { ApiError } from "@/core/errors/apiError";
import { safeRedisExpire, safeRedisIncr, safeRedisTtl } from "@/core/cache/redis";
const rateLimitMap = new Map();
setInterval(() => {
    rateLimitMap.clear();
}, 60000);
export function basicRateLimit(key, windowMs = 500) {
    const now = Date.now();
    const last = rateLimitMap.get(key) || 0;
    if (now - last < windowMs) {
        throw new ApiError(429, "Too many requests");
    }
    rateLimitMap.set(key, now);
    if (rateLimitMap.size > 10000) {
        rateLimitMap.clear();
    }
}
export async function rateLimitRedis(key, limit = 5, windowSeconds = 1) {
    const redisKey = `rate:${key}`;
    const count = await safeRedisIncr(redisKey);
    if (!count) {
        if (process.env.NODE_ENV === "production") {
            throw new ApiError(503, "Rate limiting unavailable");
        }
        return null;
    }
    if (count === 1) {
        await safeRedisExpire(redisKey, windowSeconds);
    }
    else {
        const ttl = await safeRedisTtl(redisKey);
        if (ttl === -1 || ttl === null) {
            await safeRedisExpire(redisKey, windowSeconds);
        }
    }
    if (count > limit) {
        throw new ApiError(429, "Too many requests");
    }
    return count;
}
