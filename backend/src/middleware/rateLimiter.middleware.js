import { rateLimitRedis } from "@/core/security/rateLimit";
import { ApiError } from "@/core/errors/apiError";
let didLogRateLimitDisabled = false;
const isProd = process.env.NODE_ENV === "production";
function maybeBypassLimiter() {
    if (process.env.DISABLE_RATE_LIMIT === "true") {
        if (process.env.NODE_ENV === "production") {
            console.error("[rate-limit] DISABLE_RATE_LIMIT ignored in production");
            return null;
        }
        if (!didLogRateLimitDisabled) {
            // Log once per process to confirm load-test bypass.
            console.warn("[rate-limit] disabled for testing");
            didLogRateLimitDisabled = true;
        }
        return (_req, _res, next) => next();
    }
    return null;
}
function buildLimiter(options) {
    const bypass = maybeBypassLimiter();
    if (bypass)
        return bypass;
    return async (req, res, next) => {
        if (options.shouldSkip?.(req)) {
            return next();
        }
        const ip = req.ip ?? "unknown";
        const key = `${options.keyPrefix}:${ip}`;
        const windowSeconds = Math.ceil(options.windowMs / 1000);
        try {
            const count = await rateLimitRedis(key, options.max, windowSeconds);
            if (!count) {
                if (process.env.NODE_ENV === "production") {
                    return res.status(503).json({
                        success: false,
                        message: "Rate limiting unavailable",
                    });
                }
                return next();
            }
            res.setHeader("X-RateLimit-Limit", String(options.max));
            res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - count)));
            return next();
        }
        catch (err) {
            if (err instanceof ApiError) {
                return res.status(err.status).json({
                    success: false,
                    message: err.status === 429 ? options.message.message : err.message,
                });
            }
            return next(err);
        }
    };
}
/*
GLOBAL API LIMITER
protects entire API
*/
export const apiLimiter = buildLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 300 : 1000,
    keyPrefix: "api",
    message: {
        success: false,
        message: "Too many requests. Try again later.",
    },
    shouldSkip: (req) => {
        const url = req.originalUrl ?? "";
        if (url.startsWith("/api/v1/auth/me") || url.startsWith("/api/v1/auth/refresh")) {
            return true;
        }
        if (req.method !== "GET")
            return false;
        return (url.startsWith("/api/v1/school/overview") ||
            url.startsWith("/api/v1/notifications/unread-count") ||
            url.startsWith("/api/v1/dashboard/teacher") ||
            url.startsWith("/api/v1/messages/teacher-unread") ||
            url.startsWith("/api/v1/messages/unread-count"));
    },
});
/*
AUTH LIMITER
protect login brute force
*/
export const authLimiter = buildLimiter({
    windowMs: isProd ? 15 * 60 * 1000 : 2 * 60 * 1000,
    max: isProd ? 20 : 200,
    keyPrefix: "auth",
    message: {
        success: false,
        message: "Too many login attempts. Try again later.",
    },
});
export const authActionLimiter = buildLimiter({
    windowMs: isProd ? 15 * 60 * 1000 : 5 * 60 * 1000,
    max: isProd ? 50 : 200,
    keyPrefix: "auth-action",
    message: {
        success: false,
        message: "Too many auth requests. Try again later.",
    },
});
/*
OTP LIMITER
protect SMS spam + brute force
*/
export const otpLimiter = buildLimiter({
    windowMs: isProd ? 10 * 60 * 1000 : 60 * 1000,
    max: isProd ? 10 : 10,
    keyPrefix: "otp",
    message: {
        success: false,
        message: "Too many OTP requests. Try again later.",
    },
});
/*
ATTENDANCE LIMITER
protect attendance marking/update endpoints
*/
export const attendanceLimiter = buildLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyPrefix: "attendance",
    message: {
        success: false,
        message: "Too many attendance requests. Try again later.",
    },
});
/*
HEAVY JOB LIMITER
protect heavy write or recompute endpoints
*/
export const heavyJobLimiter = buildLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    keyPrefix: "heavy",
    message: {
        success: false,
        message: "Too many heavy requests. Try again later.",
    },
});
