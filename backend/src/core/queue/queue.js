import { Queue } from "bullmq";
import { getRedis } from "@/core/redis";
import { createBullMQConnection } from "@/core/queue/redisBullmq";
function createDisabledQueue() {
    return {
        async add() {
            return null;
        },
        async getJobCounts() {
            return {
                waiting: 0,
                active: 0,
                delayed: 0,
                failed: 0,
                completed: 0,
            };
        },
    };
}
const disabledQueue = createDisabledQueue();
let jobQueue = null;
export async function getJobQueue() {
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
    }
    catch (err) {
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
        },
    });
    void jobQueue.client?.then((client) => client.on("error", () => { })).catch(() => { });
    return jobQueue;
}
