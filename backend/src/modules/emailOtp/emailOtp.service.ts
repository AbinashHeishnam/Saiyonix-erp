import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";
import { hashRefreshToken } from "@/utils/refreshToken";
import { sendOtpEmail } from "@/services/email/email.service";

const EMAIL_OTP_PURPOSE_LOGIN = "LOGIN";
const REFRESH_TOKEN_TTL_DAYS = 30;

const EMAIL_OTP_ALLOWED_ROLES = new Set([
  "ADMIN",
  "ACADEMIC_SUB_ADMIN",
  "FINANCE_SUB_ADMIN",
  "TEACHER",
]);

const EMAIL_OTP_EXPIRY_MS = env.EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000;
const EMAIL_OTP_RESEND_COOLDOWN_MS =
  env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = env.EMAIL_OTP_MAX_ATTEMPTS;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

type DbClient = typeof prisma;

async function ensureStaffRoleLink(
  user: { id: string; role: { roleType: string }; schoolId: string },
  db: DbClient
) {
  if (user.role.roleType === "TEACHER") {
    const teacher = await db.teacher.findFirst({
      where: { userId: user.id, schoolId: user.schoolId, deletedAt: null },
      select: { status: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
    if (teacher.status !== "ACTIVE") {
      throw new ApiError(403, "Teacher account is not active");
    }
  }
}

async function getEmailOtpUserOrThrow(email: string, db: DbClient) {
  const normalizedEmail = normalizeEmail(email);
  const user = await db.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: Prisma.QueryMode.insensitive } },
    include: { role: true },
  });

  if (!user) {
    logger.warn(`[AUTH] EMAIL_OTP_SEND failed reason=USER_NOT_FOUND email=${normalizedEmail}`);
    throw new ApiError(404, "Email not registered");
  }

  if (!EMAIL_OTP_ALLOWED_ROLES.has(user.role.roleType)) {
    logger.warn(`[AUTH] EMAIL_OTP_SEND failed reason=ROLE_NOT_ALLOWED user=${user.id}`);
    throw new ApiError(403, "Email OTP login allowed only for staff accounts");
  }

  if (!user.isActive) {
    logger.warn(`[AUTH] EMAIL_OTP_SEND failed reason=INACTIVE_USER user=${user.id}`);
    throw new ApiError(403, "User account is inactive");
  }

  await ensureStaffRoleLink(user, db);

  return user;
}

async function deliverEmailOtp(email: string, otp: string, purpose: string) {
  await sendOtpEmail({
    to: email,
    otp,
    purpose,
    expiresInMinutes: env.EMAIL_OTP_EXPIRY_MINUTES,
  });
}

async function upsertEmailOtp(
  db: DbClient,
  params: {
  email: string;
  userId: string;
  purpose: string;
  otpHash: string;
  expiresAt: Date;
  now: Date;
  existingId?: string;
}
) {
  if (params.existingId) {
    await db.emailOtpLog.update({
      where: { id: params.existingId },
      data: {
        userId: params.userId,
        email: params.email,
        purpose: params.purpose,
        otpHash: params.otpHash,
        expiresAt: params.expiresAt,
        attemptCount: 0,
        lockedUntil: null,
        isConsumed: false,
        lastSentAt: params.now,
      },
    });
    return;
  }

  await db.emailOtpLog.create({
    data: {
      userId: params.userId,
      email: params.email,
      purpose: params.purpose,
      otpHash: params.otpHash,
      expiresAt: params.expiresAt,
      attemptCount: 0,
      isConsumed: false,
      lastSentAt: params.now,
    },
  });
}

export async function requestEmailOtp(email: string) {
  const normalizedEmail = normalizeEmail(email);
  logger.info(`[AUTH] EMAIL_OTP_SEND attempt email=${normalizedEmail}`);

  const { otp } = await prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    const user = await getEmailOtpUserOrThrow(normalizedEmail, db);
    const existing = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: EMAIL_OTP_PURPOSE_LOGIN,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try again later");
    }

    if (
      existing?.lastSentAt &&
      Date.now() - existing.lastSentAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + EMAIL_OTP_EXPIRY_MS);
    const now = new Date();

    await upsertEmailOtp(tx as DbClient, {
      email: normalizedEmail,
      userId: user.id,
      purpose: EMAIL_OTP_PURPOSE_LOGIN,
      otpHash,
      expiresAt,
      now,
      existingId: existing?.id,
    });

    return { otp };
  });

  await deliverEmailOtp(normalizedEmail, otp, EMAIL_OTP_PURPOSE_LOGIN);

  return { message: "OTP sent successfully" };
}

export async function resendEmailOtp(email: string) {
  const normalizedEmail = normalizeEmail(email);
  logger.info(`[AUTH] EMAIL_OTP_RESEND attempt email=${normalizedEmail}`);

  const { otp } = await prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    const user = await getEmailOtpUserOrThrow(normalizedEmail, db);
    const existing = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: EMAIL_OTP_PURPOSE_LOGIN,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try again later");
    }

    if (
      existing?.lastSentAt &&
      Date.now() - existing.lastSentAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + EMAIL_OTP_EXPIRY_MS);
    const now = new Date();

    await upsertEmailOtp(tx as DbClient, {
      email: normalizedEmail,
      userId: user.id,
      purpose: EMAIL_OTP_PURPOSE_LOGIN,
      otpHash,
      expiresAt,
      now,
      existingId: existing?.id,
    });

    return { otp };
  });

  await deliverEmailOtp(normalizedEmail, otp, EMAIL_OTP_PURPOSE_LOGIN);

  return { message: "OTP resent successfully" };
}

export async function verifyEmailOtp(email: string, otp: string) {
  const normalizedEmail = normalizeEmail(email);
  logger.info(`[AUTH] EMAIL_OTP_VERIFY attempt email=${normalizedEmail}`);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  const refreshToken = uuidv4();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const { user } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: Prisma.QueryMode.insensitive } },
      include: { role: true },
    });

    if (!user) {
      logger.warn(`[AUTH] EMAIL_OTP_VERIFY failed reason=USER_NOT_FOUND email=${normalizedEmail}`);
      throw new ApiError(404, "Email not registered");
    }

    if (!EMAIL_OTP_ALLOWED_ROLES.has(user.role.roleType)) {
      logger.warn(`[AUTH] EMAIL_OTP_VERIFY failed reason=ROLE_NOT_ALLOWED user=${user.id}`);
      throw new ApiError(403, "Email OTP login allowed only for staff accounts");
    }

    if (!user.isActive) {
      logger.warn(`[AUTH] EMAIL_OTP_VERIFY failed reason=INACTIVE_USER user=${user.id}`);
      throw new ApiError(403, "User account is inactive");
    }

    await ensureStaffRoleLink(user, tx as DbClient);

    const record = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: EMAIL_OTP_PURPOSE_LOGIN,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      logger.warn(`[AUTH] EMAIL_OTP_VERIFY failed reason=NO_RECORD email=${normalizedEmail}`);
      throw new ApiError(400, "Invalid OTP");
    }

    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try again later");
    }

    if (record.expiresAt < new Date()) {
      await tx.emailOtpLog.update({
        where: { id: record.id },
        data: { isConsumed: true },
      });
      throw new ApiError(400, "OTP expired");
    }

    const isOtpValid = await bcrypt.compare(otp, record.otpHash);

    if (!isOtpValid) {
      const attempts = record.attemptCount + 1;
      const shouldBlock = attempts >= EMAIL_OTP_MAX_ATTEMPTS;

      await tx.emailOtpLog.update({
        where: { id: record.id },
        data: {
          attemptCount: attempts,
          isConsumed: shouldBlock ? true : record.isConsumed,
        },
      });

      if (shouldBlock) {
        throw new ApiError(429, "Too many attempts. Request a new OTP");
      }

      throw new ApiError(400, "Invalid OTP");
    }

    await tx.emailOtpLog.update({
      where: { id: record.id },
      data: {
        isConsumed: true,
        attemptCount: 0,
        lockedUntil: null,
      },
    });

    await tx.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        roleId: user.roleId,
        roleType: user.role.roleType,
        expiresAt: getRefreshTokenExpiry(),
        deviceId: null,
        ipAddress: null,
        userAgent: null,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { role: true },
    });

    return { user: updatedUser };
  });

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleType: user.role.roleType,
      schoolId: user.schoolId,
    },
    jwtSecret,
    { expiresIn: "15m" }
  );

  logger.info(`[AUTH] EMAIL_OTP_VERIFY success user=${user.id}`);
  logger.info(`[AUTH] EMAIL_OTP_VERIFY role=${user.role.roleType} user=${user.id}`);

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    userId: user.id,
    role: user.role.roleType,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      roleId: user.roleId,
      mustChangePassword: user.mustChangePassword,
      phoneVerified: user.isMobileVerified,
      role: user.role,
      restricted: false,
    },
  };
}
