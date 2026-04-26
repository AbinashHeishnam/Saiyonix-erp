import { createClient } from "redis";
const redis = createClient({
    url: process.env.REDIS_URL,
});
let redisReady = false;
let redisConnectPromise = null;
redis.on("error", (err) => {
    if (process.env.NODE_ENV !== "production") {
        console.error("Redis error:", err);
    }
});
async function getRedisClient() {
    if (process.env.REDIS_ENABLED === "false") {
        return null;
    }
    if (!redisConnectPromise) {
        redisConnectPromise = redis
            .connect()
            .then(() => {
            redisReady = true;
        })
            .catch(() => {
            redisReady = false;
        });
    }
    if (!redisReady) {
        try {
            await redisConnectPromise;
        }
        catch {
            return null;
        }
    }
    return redisReady ? redis : null;
}
export { redis };
export async function safeRedisGet(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return null;
        return await client.get(key);
    }
    catch {
        return null;
    }
}
export async function safeRedisSet(key, value, ttl = 60) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.set(key, value, { EX: ttl });
    }
    catch {
        // ignore
    }
}
export async function safeRedisIncr(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return null;
        return await client.incr(key);
    }
    catch {
        return null;
    }
}
export async function safeRedisExpire(key, ttlSeconds) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.expire(key, ttlSeconds);
    }
    catch {
        // ignore
    }
}
export async function safeRedisTtl(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return null;
        return await client.ttl(key);
    }
    catch {
        return null;
    }
}
export async function safeRedisDel(key) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.del(key);
    }
    catch {
        // ignore
    }
}
