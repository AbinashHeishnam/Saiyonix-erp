import IORedis from "ioredis";
import { env } from "@/config/env";

let redisConnection: IORedis | null = null;

export async function getRedis() {
  if (env.REDIS_ENABLED === "false") {
    return null;
  }

  if (redisConnection) return redisConnection;

  try {
    const client = new IORedis(env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      lazyConnect: true,
      retryStrategy: () => null,
      reconnectOnError: () => false,
      maxRetriesPerRequest: 1,
    });
    client.on("error", () => {
      // swallow error to prevent "Unhandled error event"
    });

    await client.connect();
    await client.ping();

    redisConnection = client;

    console.log("✅ Redis connected");
    return redisConnection;
  } catch (err) {
    if (process.env.REDIS_ENABLED !== "false") {
      console.warn("[redis] disabled (not available)");
    }
    redisConnection = null;
    return null;
  }
}
