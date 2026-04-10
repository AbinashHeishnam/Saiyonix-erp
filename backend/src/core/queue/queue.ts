import { Queue, type QueueOptions } from "bullmq";
import { getRedis } from "@/core/redis";
import { createBullMQConnection } from "@/core/queue/redisBullmq";

type DisabledQueue = {
  add: Queue["add"];
  getJobCounts: Queue["getJobCounts"];
};

function createDisabledQueue(): DisabledQueue {
  return {
    async add() {
      return null as any;
    },
    async getJobCounts() {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      } as any;
    },
  };
}

const disabledQueue = createDisabledQueue();
let jobQueue: Queue | null = null;

export async function getJobQueue(): Promise<Queue | DisabledQueue> {
  if (jobQueue) {
    return jobQueue;
  }

  const redis = await getRedis();
  if (!redis) {
    return disabledQueue;
  }

  let connection;
  try {
    connection = createBullMQConnection();
  } catch (err) {
    console.error("[queue] BullMQ connection init failed", err);
    return disabledQueue;
  }

  jobQueue = new Queue("saiyonix-jobs", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
      timeout: 120_000,
    } as QueueOptions["defaultJobOptions"],
  });
  void jobQueue.client?.then((client) => client.on("error", () => {})).catch(() => {});

  return jobQueue;
}
