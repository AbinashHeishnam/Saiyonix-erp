import prisma from "@/core/db/prisma";

const MAX_BUFFER_AGE = 10000;
const seenBuffer = new Map<string, { ids: Set<string>; ts: number }>();
let intervalStarted = false;

export function queueSeen(roomId: string, userId: string, messageId: string) {
  try {
    if (seenBuffer.size > 5000) {
      seenBuffer.clear();
    }

    const key = `${roomId}:${userId}`;

    if (!seenBuffer.has(key)) {
      seenBuffer.set(key, { ids: new Set(), ts: Date.now() });
    }

    const entry = seenBuffer.get(key)!;
    entry.ids.add(messageId);
    entry.ts = Date.now();
  } catch (err) {
    console.error("[CHAT] queue seen error", err);
  }
}

async function flushSeenBuffer() {
  if (seenBuffer.size === 0) {
    return;
  }
  let timerStarted = false;
  try {
    console.time("[CHAT] seen flush");
    timerStarted = true;

    for (const [key, entry] of seenBuffer.entries()) {
      if (!entry.ids.size) {
        seenBuffer.delete(key);
        continue;
      }

      if (Date.now() - entry.ts > MAX_BUFFER_AGE) {
        seenBuffer.delete(key);
        continue;
      }

      const [roomId, userId] = key.split(":");
      const messageIds = Array.from(entry.ids);
      if (!roomId || !userId || !messageIds.length) {
        seenBuffer.delete(key);
        continue;
      }

      try {
        await prisma.messageSeen.createMany({
          data: messageIds.map((messageId) => ({
            messageId,
            userId,
          })),
          skipDuplicates: true,
        });

        seenBuffer.delete(key);
      } catch (err) {
        console.error("[CHAT] batch seen error", err);
      }

      await new Promise((resolve) => setImmediate(resolve));
    }
  } catch (err) {
    console.error("[CHAT] batch seen flush error", err);
  } finally {
    if (timerStarted) {
      try {
        console.timeEnd("[CHAT] seen flush");
      } catch {}
    }
    if (seenBuffer.size > 0) {
      console.log("[CHAT] buffer size:", seenBuffer.size);
    }
  }
}

function ensureInterval() {
  if (intervalStarted) return;
  intervalStarted = true;
  const scheduleFlush = () => {
    setTimeout(async () => {
      try {
        await flushSeenBuffer();
      } catch {
        // ignore interval failures
      }

      scheduleFlush();
    }, seenBuffer.size > 0 ? 2000 : 5000).unref();
  };
  scheduleFlush();
}

ensureInterval();

async function gracefulShutdown(signal: string) {
  try {
    console.log(`[CHAT] ${signal} received, flushing seen buffer...`);
    await flushSeenBuffer();
  } catch (err) {
    console.error("[CHAT] shutdown flush failed", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
