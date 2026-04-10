import "dotenv/config";
if (process.env.REDIS_ENABLED === "false") {
  process.env.BULLMQ_DISABLE_REDIS = "true";
}

if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_LOGS !== "true") {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}
import cluster from "node:cluster";
import os from "node:os";
import { createServer } from "node:http";
import { env } from "@/config/env";
import app, { registerBullBoard } from "./app";
import { markNotificationWorkerDisabled, startNotificationWorker } from "@/core/jobs/notificationWorker";
import prisma from "@/core/db/prisma";
import { logger } from "@/utils/logger";
import { getRedis } from "@/core/redis";
import { initSocket } from "@/socket";
import { startQueueWorkers } from "@/core/queue/worker";

const PORT = env.PORT;
const CLUSTER_ENABLED = process.env.CLUSTER_ENABLED === "true";
const WORKER_COUNT = Math.max(1, Number(process.env.WEB_CONCURRENCY ?? os.cpus().length));
const LOG_HTTP_TRAFFIC =
  process.env.LOG_HTTP_TRAFFIC === "true" || process.env.NODE_ENV !== "production";

let stopWorker: (() => void) | null = null;
let server: ReturnType<typeof createServer> | null = null;

async function startServer() {
  await registerBullBoard(app);
  try {
    // Static uploads disabled; access must go through /api/v1/files/secure
  } catch (err) {
    console.error("[uploads] static setup failed", err);
  }
  const httpServer = createServer(app);
  initSocket(httpServer);
  server = httpServer;
  server.listen(PORT, () => {
    logger.info(`SaiyoniX ERP API running on port ${PORT}`);
    void validateStartup();
    try {
      void startQueueWorkers();
    } catch (err) {
      logger.error("Queue workers failed to start", err);
    }

    if (process.env.WORKER_ENABLED === "true") {
      try {
        stopWorker = startNotificationWorker();
        logger.info("Notification worker started");
      } catch (err) {
        logger.error("Notification worker failed to start", err);
      }
    } else {
      markNotificationWorkerDisabled();
      logger.info("Notification worker disabled (WORKER_ENABLED not set to true)");
    }
  });

  if (LOG_HTTP_TRAFFIC && server) {
    server.on("connection", (socket) => {
      logger.info(`[server] connection remote=${socket.remoteAddress}`);
    });

    server.on("request", (req) => {
      logger.info(`[server] request ${req.method} ${req.url}`);
    });
  }

  return server;
}

async function validateStartup() {
  try {
    await prisma.$connect();
    logger.info("[system] DB connected");
  } catch (error) {
    logger.error("[system] DB connection failed", error);
    process.exit(1);
  }

  const redis = await getRedis();
  if (env.REDIS_ENABLED !== "false") {
    logger.info(`[system] Redis ${redis ? "connected" : "disabled"}`);
  }

  try {
    await prisma.$queryRaw`SELECT "timetablePublishedAt" FROM "Exam" LIMIT 1`;
    logger.info("[system] Prisma schema validated");
  } catch (error) {
    logger.warn(
      "[system] Prisma schema mismatch detected (Exam.timetablePublishedAt missing). Run prisma migrate deploy or prisma db push."
    );
  }
}

if (CLUSTER_ENABLED && cluster.isPrimary) {
  logger.info(`[cluster] primary starting ${WORKER_COUNT} workers`);
  for (let i = 0; i < WORKER_COUNT; i += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      `[cluster] worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Restarting.`
    );
    cluster.fork();
  });
} else {
  void startServer();
}

export { server };

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (stopWorker) {
      stopWorker();
    }
    await prisma.$disconnect();
  } catch (error) {
    logger.error("Error disconnecting Prisma", error);
  }

  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("[system] Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("[system] Uncaught exception", error);
  process.exit(1);
});
