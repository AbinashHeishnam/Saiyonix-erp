import "dotenv/config";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_LOGS !== "true") {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import prisma from "@/core/db/prisma";
import { Queue } from "bullmq";
import { getJobQueue } from "@/core/queue/queue";
import { getRedis } from "@/core/redis";
import { getJobWorker } from "@/core/queue/worker";
import { env } from "@/config/env";

async function setupRepeatableJobs() {
  const redis = await getRedis();
  if (!redis) {
    if (env.REDIS_ENABLED !== "false") {
      console.warn("[system] Redis disabled or unavailable; skipping repeatable jobs");
    }
    return;
  }

  await getJobWorker();

  const jobQueue = await getJobQueue();
  if (!(jobQueue instanceof Queue)) {
    return;
  }

  const schools = await prisma.school.findMany({ select: { id: true } });
  for (const school of schools) {
    await jobQueue.add(
      "ASSIGNMENT_REMINDER",
      { type: "ASSIGNMENT_REMINDER", schoolId: school.id },
      {
        jobId: `assignment-reminder:${school.id}`,
        repeat: { every: 60 * 60 * 1000 },
      }
    );
  }

  setInterval(async () => {
    try {
      const queue = await getJobQueue();
      if (!(queue instanceof Queue)) return;
      const counts = await queue.getJobCounts("waiting", "active", "failed", "completed");
      console.log(
        `[worker:heartbeat] waiting=${counts.waiting} active=${counts.active} failed=${counts.failed} completed=${counts.completed}`
      );
    } catch (error) {
      console.error("[worker:heartbeat:error]", error);
    }
  }, 60_000);
}

setupRepeatableJobs().catch((error) => {
  console.error("Failed to setup repeatable jobs", error);
  process.exit(1);
});
