import "dotenv/config";

// ✅ Fix path alias resolution
import "tsconfig-paths/register";

import prisma from "@/core/db/prisma";
import { Queue } from "bullmq";
import { getJobQueue } from "@/core/queue/queue";
import { getRedis } from "@/core/redis";
import { getJobWorker } from "@/core/queue/worker";
import { env } from "@/config/env";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_LOGS !== "true") {
  console.log = () => { };
  console.info = () => { };
  console.debug = () => { };
}

async function setupRepeatableJobs() {
  console.log("[worker] Starting worker...");

  const redis = await getRedis();
  if (!redis) {
    console.warn("[worker] Redis not available");
    return;
  }

  // ✅ THIS ACTUALLY STARTS YOUR QUEUE PROCESSOR
  await getJobWorker();
  console.log("[worker] Job worker initialized");

  const jobQueue = await getJobQueue();
  if (!(jobQueue instanceof Queue)) {
    console.error("[worker] Queue not initialized");
    return;
  }

  console.log("[worker] Queue connected");

  const schools = await prisma.school.findMany({
    select: { id: true },
  });

  console.log(`[worker] Found ${schools.length} schools`);

  for (const school of schools) {
    await jobQueue.add(
      "ASSIGNMENT_REMINDER",
      { type: "ASSIGNMENT_REMINDER", schoolId: school.id },
      {
        jobId: `assignment-reminder:${school.id}`,
        repeat: { every: 60 * 60 * 1000 },
      }
    );

    await jobQueue.add(
      "NOTIFICATION_MONITOR",
      { type: "NOTIFICATION_MONITOR", schoolId: school.id },
      {
        jobId: `notification-monitor:${school.id}`,
        repeat: { every: 5 * 60 * 1000 },
      }
    );

    await jobQueue.add(
      "PUSH_TOKEN_CLEANUP",
      { type: "PUSH_TOKEN_CLEANUP", schoolId: school.id },
      {
        jobId: `push-token-cleanup:${school.id}`,
        repeat: { every: 24 * 60 * 60 * 1000 },
      }
    );
  }

  console.log("[worker] Repeatable jobs scheduled");

  // ✅ Heartbeat for debugging
  setInterval(async () => {
    try {
      const queue = await getJobQueue();
      if (!(queue instanceof Queue)) return;

      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "failed",
        "completed"
      );

      console.log(
        `[worker:heartbeat] waiting=${counts.waiting} active=${counts.active} failed=${counts.failed} completed=${counts.completed}`
      );
    } catch (error) {
      console.error("[worker:heartbeat:error]", error);
    }
  }, 60000);
}

setupRepeatableJobs().catch((error) => {
  console.error("[worker] Fatal error:", error);
  process.exit(1);
});