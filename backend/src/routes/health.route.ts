import { Router } from "express";

import prisma from "@/core/db/prisma";
import { getNotificationWorkerStatus } from "@/core/jobs/notificationWorker";

const router = Router();

router.get("/health", async (_req, res) => {
  let database = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "disconnected";
  }

  const worker = getNotificationWorkerStatus();
  const status = database === "connected" ? "ok" : "degraded";

  res.status(database === "connected" ? 200 : 503).json({
    status,
    database,
    worker,
    timestamp: new Date().toISOString(),
  });
});

export default router;
