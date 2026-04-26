import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import { logger } from "@/utils/logger";
import { verifyToken } from "@/utils/jwt";
import { canJoinChatRoomSafe, markChatMessageSeen, sendChatRoomMessage } from "@/modules/classroom/service";
import prisma from "@/core/db/prisma";
import { logSecurity } from "@/core/security/logger";
import { rateLimitRedis } from "@/core/security/rateLimit";
import { env } from "@/config/env";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://school.saiyonix.com",
];

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        // React Native / native websocket clients may not send an Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  if (env.REDIS_ENABLED !== "false" && env.REDIS_URL) {
    const pubClient = createClient({ url: env.REDIS_URL });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
      })
      .catch(() => {
        // Redis adapter is optional; continue without it if unavailable.
      });
  }

  async function ensureRoomAccess(user: { userId: string; roleType: string; schoolId: string }, roomId: string) {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId },
      select: { id: true, classId: true, sectionId: true, subjectId: true },
    });
    if (!room) return null;
    const classRecord = await prisma.class.findFirst({
      where: { id: room.classId, schoolId: user.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!classRecord) return null;
    if (["ADMIN", "SUPER_ADMIN"].includes(user.roleType)) {
      return room;
    }
    const allowed = await canJoinChatRoomSafe(
      user.schoolId,
      { userId: user.userId, roleType: user.roleType },
      {
        roomId: room.id,
        classId: room.classId,
        sectionId: room.sectionId,
        subjectId: room.subjectId,
      }
    );
    if (!allowed) return null;
    return room;
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const cookieHeader = socket.handshake.headers?.cookie;
    const resolveCookie = (name: string) => {
      if (!cookieHeader) return null;
      const parts = cookieHeader.split(";").map((part) => part.trim());
      const match = parts.find((part) => part.startsWith(`${name}=`));
      if (!match) return null;
      return decodeURIComponent(match.slice(name.length + 1));
    };
    const cookieToken = resolveCookie("accessToken") ?? resolveCookie("access_token");
    const resolvedToken = typeof token === "string" ? token : cookieToken;
    if (!resolvedToken || typeof resolvedToken !== "string") {
      return next(new Error("Unauthorized"));
    }
    try {
      const payload = verifyToken(resolvedToken);
      socket.data.user = {
        userId: payload.sub,
        roleType: payload.roleType,
        schoolId: payload.schoolId,
      };
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`[socket] connected id=${socket.id}`);
    if (!socket.data.user) {
      socket.disconnect();
      return;
    }
    const seenThrottle = new Map<string, number>();
    const sendThrottle = new Map<string, number>();

    socket.on("join_room", async (payload: string | { roomId?: string }) => {
      try {
        const roomId = typeof payload === "string" ? payload : payload?.roomId;
        if (!roomId) return;
        const user = socket.data.user as { userId: string; roleType: string; schoolId: string } | undefined;
        if (!user) return;
        const room = await ensureRoomAccess(user, roomId);
        if (!room) {
          logSecurity("socket_join_blocked", { userId: user.userId, roomId });
          return;
        }
        socket.join(roomId);
        console.log("[Phase1] Socket join validated");
        logger.info(`[socket] joined id=${socket.id} room=${roomId}`);
      } catch (err) {
        console.error("[SECURITY] join_room failure:", err);
      }
    });

    socket.on(
      "send_message",
      async (data: { roomId?: string; message?: string; fileUrl?: string; replyToId?: string; clientId?: string }) => {
      try {
        const payload = socket.data.user as {
          userId: string;
          roleType: string;
          schoolId: string;
        } | undefined;
        if (!payload) return;

        const roomId = data?.roomId;
        const message = typeof data?.message === "string" ? data.message : null;
        const fileUrl = typeof data?.fileUrl === "string" ? data.fileUrl : null;
        const replyToId = typeof data?.replyToId === "string" ? data.replyToId : null;

        if (!roomId) {
          return;
        }
        const room = await ensureRoomAccess(payload, roomId);
        if (!room) {
          logSecurity("socket_send_blocked", { userId: payload.userId, roomId });
          return;
        }
        try {
          const key = `chat:${payload.userId}:${roomId}`;
          try {
            const redisCount = await rateLimitRedis(key, 5, 1);
            if (!redisCount) {
              const last = sendThrottle.get(key) ?? 0;
              if (Date.now() - last < 500) {
                logSecurity("rate_limit_send_message", { userId: payload.userId, roomId });
                return;
              }
              sendThrottle.set(key, Date.now());
            }
          } catch {
            // If Redis is unavailable, fall back to in-memory throttling.
            const last = sendThrottle.get(key) ?? 0;
            if (Date.now() - last < 500) {
              logSecurity("rate_limit_send_message", { userId: payload.userId, roomId });
              return;
            }
            sendThrottle.set(key, Date.now());
          }
        } catch (err) {
          // Never block chat sending due to rate limiter errors.
        }

        const saved = await sendChatRoomMessage(
          payload.schoolId,
          { userId: payload.userId, roleType: payload.roleType },
          roomId,
          { message, fileUrl, replyToId }
        );

        logger.info(`[socket] message room=${roomId} sender=${payload.userId}`);
        io.to(roomId).emit("receive_message", { ...saved, clientId: data?.clientId ?? null });
      } catch (error) {
        logger.error("[socket] send_message failed", error);
      }
    });

    socket.on("typing", async (roomId: string) => {
      if (!roomId) return;
      const user = socket.data.user as { userId: string; roleType: string; schoolId: string } | undefined;
      if (!user) return;
      const room = await ensureRoomAccess(user, roomId);
      if (!room) return;
      socket.to(roomId).emit("user_typing", { roomId, userId: user.userId });
    });

    socket.on("stop_typing", async (roomId: string) => {
      if (!roomId) return;
      const user = socket.data.user as { userId: string; roleType: string; schoolId: string } | undefined;
      if (!user) return;
      const room = await ensureRoomAccess(user, roomId);
      if (!room) return;
      socket.to(roomId).emit("user_stop_typing", { roomId, userId: user.userId });
    });

    socket.on("message_seen", async (data: { messageId?: string }) => {
      try {
        const payload = socket.data.user as {
          userId: string;
          roleType: string;
          schoolId: string;
        } | undefined;
        if (!payload) return;
        const messageId = data?.messageId;
        if (!messageId) return;
        const throttleKey = `${payload.userId}-${messageId}`;
        const last = seenThrottle.get(throttleKey) ?? 0;
        if (Date.now() - last < 2000) return;
        seenThrottle.set(throttleKey, Date.now());
        const message = await prisma.chatMessage.findFirst({
          where: { id: messageId },
          select: { roomId: true },
        });
        if (!message?.roomId) return;
        const room = await ensureRoomAccess(payload, message.roomId);
        if (!room) return;
        const seen = await markChatMessageSeen(
          payload.schoolId,
          { userId: payload.userId, roleType: payload.roleType },
          messageId
        );
        if (seen) {
          io.to(seen.roomId).emit("message_seen", seen);
        }
      } catch (error) {
        console.error("[Phase1] message_seen error:", error);
        logger.error("[socket] message_seen failed", error);
      }
    });
  });

  return io;
}
