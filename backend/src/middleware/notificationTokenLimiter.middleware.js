import { rateLimitRedis } from "@/core/security/rateLimit";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;
function getUserKey(req) {
    const userId = req.user?.sub ??
        req.user?.id ??
        "anon";
    const ip = req.ip ?? "unknown";
    return `${userId}:${ip}`;
}
export async function notificationTokenLimiter(req, res, next) {
    // Keep existing load-test bypass behavior.
    if (process.env.DISABLE_RATE_LIMIT === "true" && env.NODE_ENV !== "production") {
        return next();
    }
    const key = `notif-token:${getUserKey(req)}`;
    try {
        const count = await rateLimitRedis(key, MAX_REQUESTS, WINDOW_SECONDS);
        if (!count) {
            if (env.NODE_ENV === "production" && env.REDIS_ENABLED !== "false") {
                return res.status(503).json({ success: false, message: "Rate limiting unavailable" });
            }
            return next();
        }
        res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - count)));
        if (count >= 8) {
            logger.warn(`[notif-token] high frequency registrations key=${key} count=${count}`);
        }
        return next();
    }
    catch (error) {
        // `rateLimitRedis` throws for actual limits; treat as abuse signal.
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Too many requests") || message.includes("429")) {
            logger.warn(`[notif-token] rate limited key=${key} err=${message}`);
            return res.status(429).json({ success: false, message: "Too many token requests. Try again later." });
        }
        return next(error);
    }
}
