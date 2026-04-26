import { verifyToken } from "@/utils/jwt";
import { error as errorResponse } from "@/utils/apiResponse";
import prisma from "@/core/db/prisma";
import { getStudentTcRestriction } from "@/modules/auth/tcGuard";
import { safeRedisDel, safeRedisGet, safeRedisSet } from "@/core/cache/redis";
import { validateCsrfToken } from "@/core/security/csrf";
export function extractTokenFromRequest(req) {
    const headerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies?.access_token ||
        req.cookies?.accessToken;
    const queryToken = req.originalUrl.includes("/files/secure") &&
        typeof req.query?.token === "string"
        ? req.query?.token
        : null;
    const isFileRoute = req.originalUrl.includes("/files/secure");
    if (isFileRoute) {
        return headerToken || queryToken || cookieToken || null;
    }
    return headerToken || cookieToken || null;
}
const userCache = new Map();
const AUTH_CACHE_TTL_MS = 3000;
export async function updateAuthUserCache(userId, data) {
    userCache.set(userId, { data, time: Date.now() });
    await safeRedisSet(`user:${userId}`, JSON.stringify(data), 30);
}
export async function invalidateAuthUserCache(userId) {
    userCache.delete(userId);
    await safeRedisDel(`user:${userId}`);
}
async function getCachedUser(userId) {
    try {
        const cacheKey = `user:${userId}`;
        const cachedRedis = await safeRedisGet(cacheKey);
        if (cachedRedis) {
            try {
                const parsed = JSON.parse(cachedRedis);
                if (parsed && parsed.isActive) {
                    return parsed;
                }
            }
            catch {
                // ignore parse errors
            }
        }
        const cachedMemory = userCache.get(userId);
        if (cachedMemory && Date.now() - cachedMemory.time < AUTH_CACHE_TTL_MS) {
            return cachedMemory.data;
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { mustChangePassword: true, isMobileVerified: true, isActive: true },
        });
        userCache.set(userId, { data: user, time: Date.now() });
        if (user) {
            await safeRedisSet(cacheKey, JSON.stringify(user), 30);
        }
        if (!user || !user.isActive) {
            return null;
        }
        return user;
    }
    catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.error("[Phase2] Auth cache error:", err);
        }
        return null;
    }
}
export async function authMiddleware(req, res, next) {
    const headerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies?.access_token ||
        req.cookies?.accessToken;
    const queryToken = req.originalUrl.includes("/files/secure") &&
        typeof req.query?.token === "string"
        ? req.query?.token
        : null;
    const tokenSource = headerToken ? "header" : queryToken ? "query" : cookieToken ? "cookie" : "missing";
    const token = extractTokenFromRequest(req);
    if (!token || token.split(".").length !== 3) {
        if (req.originalUrl.includes("/files/secure")) {
            console.info("[AUTH] Secure file token missing/invalid", {
                source: tokenSource,
                hasToken: Boolean(token),
                tokenParts: token ? token.split(".").length : 0,
            });
        }
        return errorResponse(res, "Invalid token", 401);
    }
    try {
        const payload = req.user ?? verifyToken(token);
        req.user = {
            ...payload,
            id: payload.sub,
            email: payload.email ?? null,
            role: payload.roleType,
            roleId: payload.roleId,
            schoolId: payload.schoolId,
        };
        req.schoolId = payload.schoolId;
        req.isRestricted = false;
        const user = await getCachedUser(payload.sub);
        if (!user) {
            return errorResponse(res, "Unauthorized", 401);
        }
        if (payload.roleType === "TEACHER") {
            const isSetupRoute = req.originalUrl.startsWith("/api/v1/auth/setup");
            if (!isSetupRoute) {
                if (user.mustChangePassword || !user.isMobileVerified) {
                    return errorResponse(res, "Account setup required", 403);
                }
            }
            const teacher = await prisma.teacher.findFirst({
                where: { userId: payload.sub, schoolId: payload.schoolId, deletedAt: null },
                select: { status: true },
            });
            if (!teacher) {
                return errorResponse(res, "Teacher account not linked", 403);
            }
            if (teacher.status !== "ACTIVE") {
                return errorResponse(res, "Teacher account is inactive", 403);
            }
        }
        if (payload.roleType === "ADMIN" ||
            payload.roleType === "ACADEMIC_SUB_ADMIN" ||
            payload.roleType === "FINANCE_SUB_ADMIN") {
            const isAllowedSetupRoute = req.originalUrl.startsWith("/api/v1/auth/admin-setup") ||
                req.originalUrl.startsWith("/api/v1/auth/email-otp") ||
                req.originalUrl.startsWith("/api/v1/auth/logout") ||
                req.originalUrl.startsWith("/api/v1/auth/refresh");
            if (user.mustChangePassword && !isAllowedSetupRoute) {
                return errorResponse(res, "Account setup required", 403);
            }
        }
        if (payload.roleType === "STUDENT") {
            const student = await prisma.student.findFirst({
                where: { userId: payload.sub, schoolId: payload.schoolId, deletedAt: null },
                select: { id: true, status: true },
            });
            if (!student) {
                return errorResponse(res, "Student account not linked", 403);
            }
            req.student = student;
            if (student.status !== "ACTIVE") {
                if (student.status === "EXPELLED") {
                    const tcStatus = await getStudentTcRestriction(student.id);
                    if (tcStatus.isExpired) {
                        return errorResponse(res, "Account expired after TC", 403);
                    }
                    if (!tcStatus.isRestricted) {
                        return errorResponse(res, "Student account is inactive", 403);
                    }
                    req.isRestricted = true;
                }
                else {
                    return errorResponse(res, "Student account is inactive", 403);
                }
            }
        }
        if (payload.roleType === "PARENT") {
            const parent = await prisma.parent.findFirst({
                where: { userId: payload.sub, schoolId: payload.schoolId },
                select: {
                    id: true,
                    studentLinks: {
                        where: { student: { schoolId: payload.schoolId, deletedAt: null } },
                        select: {
                            student: { select: { id: true, status: true } },
                        },
                    },
                },
            });
            if (!parent) {
                return errorResponse(res, "Parent account not linked", 403);
            }
            if (!parent.studentLinks.length) {
                return errorResponse(res, "Parent is not linked to any student", 403);
            }
            let hasActiveStudent = false;
            let hasRestrictedStudent = false;
            let hasExpiredStudent = false;
            for (const link of parent.studentLinks) {
                const student = link.student;
                if (!student)
                    continue;
                if (student.status === "ACTIVE") {
                    hasActiveStudent = true;
                    continue;
                }
                if (student.status === "EXPELLED") {
                    const tcStatus = await getStudentTcRestriction(student.id);
                    if (tcStatus.isExpired) {
                        hasExpiredStudent = true;
                    }
                    else if (tcStatus.isRestricted) {
                        hasRestrictedStudent = true;
                    }
                }
            }
            if (!hasActiveStudent) {
                if (hasRestrictedStudent) {
                    req.isRestricted = true;
                }
                else if (hasExpiredStudent) {
                    return errorResponse(res, "Parent access expired", 403);
                }
                else {
                    return errorResponse(res, "No active students linked", 403);
                }
            }
        }
        const method = req.method.toUpperCase();
        const isFileRoute = req.originalUrl.includes("/files/secure");
        if (!isFileRoute &&
            !headerToken &&
            (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
            const csrfHeader = req.headers["x-csrf-token"];
            if (!csrfHeader || !validateCsrfToken(req.user.id ?? "", csrfHeader)) {
                return errorResponse(res, "Invalid CSRF token", 403);
            }
        }
        next();
    }
    catch (error) {
        if (req.originalUrl.includes("/files/secure")) {
            console.info("[AUTH] Secure file token rejected", {
                source: tokenSource,
            });
        }
        return errorResponse(res, "Invalid or expired token", 401);
    }
}
