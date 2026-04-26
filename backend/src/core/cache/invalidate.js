import { getRedis } from "@/core/redis";
export async function safeRedisDel(keys) {
    try {
        const redis = await getRedis();
        if (!redis)
            return;
        if (Array.isArray(keys)) {
            if (!keys.length)
                return;
            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
                chunks.push(keys.slice(i, i + CHUNK_SIZE));
            }
            await Promise.all(chunks.map((chunk) => redis.del(...chunk)));
            return;
        }
        await redis.del(keys);
    }
    catch {
        // ignore cache failures
    }
}
