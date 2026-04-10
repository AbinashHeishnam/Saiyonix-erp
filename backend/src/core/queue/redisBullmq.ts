import type { ConnectionOptions } from "bullmq";

let connection: ConnectionOptions | null = null;

function buildConnectionOptions(redisUrl: string): ConnectionOptions {
  try {
    const url = new URL(redisUrl);
    const db = url.pathname ? Number(url.pathname.slice(1)) : undefined;
    return {
      host: url.hostname || "127.0.0.1",
      port: url.port ? Number(url.port) : 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      ...(Number.isFinite(db) ? { db } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}

export function createBullMQConnection(): ConnectionOptions {
  if (connection) return connection;

  try {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    connection = buildConnectionOptions(redisUrl);

    console.log("[queue] BullMQ connection created");

    return connection;
  } catch (err) {
    console.error("[queue] BullMQ connection failed", err);
    throw err;
  }
}
