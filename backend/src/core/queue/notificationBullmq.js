import { Queue } from "bullmq";
import { getRedis } from "@/core/redis";
import { createBullMQConnection } from "@/core/queue/redisBullmq";
let notificationQueue = null;
export async function getNotificationQueue() {
    if (notificationQueue) {
        return notificationQueue;
    }
    const redis = await getRedis();
    if (!redis) {
        return null;
    }
    let connection;
    try {
        connection = createBullMQConnection();
    }
    catch (err) {
        console.error("[queue] BullMQ connection init failed", err);
        return null;
    }
    notificationQueue = new Queue("notification", {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
        },
    });
    void notificationQueue.client?.then((client) => client.on("error", () => { })).catch(() => { });
    return notificationQueue;
}
