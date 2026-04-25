import "dotenv/config";
import "tsconfig-paths/register";

import { Worker } from "bullmq";

import { createBullMQConnection } from "@/core/queue/redisBullmq";
import { deliverQueuedNotification } from "@/services/notificationService";

const QUEUE_NAME = "notification"; // MUST match queue file
const JOB_NAME = "deliver-notification";

const concurrency = Math.min(
  Math.max(Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 10), 1),
  50
);

async function startWorker() {
  console.log(`[worker] starting notification worker (queue=${QUEUE_NAME})`);

  const connection = createBullMQConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) {
        console.log(`[worker:skip] job=${job.name}`);
        return;
      }

      const { notificationId } = job.data as { notificationId?: string };

      if (!notificationId) {
        throw new Error("Missing notificationId");
      }

      console.log(`[worker:start] notificationId=${notificationId}`);

      await deliverQueuedNotification({ notificationId });

      console.log(`[worker:done] notificationId=${notificationId}`);
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[worker:failed] job=${job?.id} error=${err?.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[worker:error]", err);
  });

  process.on("SIGINT", async () => {
    console.log("[worker] shutting down...");
    await worker.close();
    process.exit(0);
  });
}

startWorker().catch((err) => {
  console.error("[worker:fatal]", err);
  process.exit(1);
});