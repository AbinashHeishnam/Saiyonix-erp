import "dotenv/config";
import { env } from "./config/env";
import app from "./app";
import { markNotificationWorkerDisabled, startNotificationWorker } from "./core/jobs/notificationWorker";
import prisma from "./core/db/prisma";
import { logger } from "./utils/logger";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`SaiyoniX ERP API running on port ${PORT}`);

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

export { server };

let shuttingDown = false;
let stopWorker: (() => void) | null = null;

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

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
