import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import prisma from "@/core/db/prisma";
import { sendPhoneOtp } from "../../services/sms.service";
import { ApiError } from "@/core/errors/apiError";
import { assertOtpDeliveryConfigured, resolveOtpDeliveryMode } from "@/services/sms/config";
import type { OtpDeliveryMode } from "@/services/sms/types";
import { logger } from "@/utils/logger";
import { getStudentTcRestriction } from "@/modules/auth/tcGuard";
import { hashRefreshToken } from "@/utils/refreshToken";

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const REFRESH_TOKEN_TTL_DAYS = 7;

async function ensureOtpDeliveryConfigured() {
  if (process.env.NODE_ENV === "production") {
    await assertOtpDeliveryConfigured();
  }
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

type DbClient = typeof prisma;

type OtpEffectiveRole = "STUDENT" | "PARENT";

async function ensureOtpRoleLink(
  user: {
    id: string;
    role: { roleType: string };
    schoolId: string;
  },
  roleType: OtpEffectiveRole,
  db: DbClient
): Promise<{ isRestricted: boolean }> {
  let isRestricted = false;
  if (roleType === "STUDENT") {
    const student = await db.student.findFirst({
      where: { userId: user.id, schoolId: user.schoolId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    if (student.status !== "ACTIVE") {
      if (student.status === "EXPELLED") {
        const tcStatus = await getStudentTcRestriction(student.id);
        if (tcStatus.isExpired) {
          throw new ApiError(403, "Account disabled permanently");
        }
        if (!tcStatus.isRestricted) {
          throw new ApiError(403, "Student account is not active");
        }
        isRestricted = true;
      } else {
        throw new ApiError(403, "Student account is not active");
      }
    }
  }

  if (roleType === "PARENT") {
    const parent = await db.parent.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }
    const link = await db.parentStudentLink.findFirst({
      where: { parentId: parent.id, student: { schoolId: user.schoolId, deletedAt: null } },
      select: { id: true },
    });
    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }
    const links = await db.parentStudentLink.findMany({
      where: { parentId: parent.id, student: { schoolId: user.schoolId, deletedAt: null } },
      select: { student: { select: { id: true, status: true } } },
    });

    let hasActiveStudent = false;
    let hasRestrictedStudent = false;
    let hasExpiredStudent = false;

    for (const entry of links) {
      const student = entry.student;
      if (!student) continue;
      if (student.status === "ACTIVE") {
        hasActiveStudent = true;
        continue;
      }
      if (student.status === "EXPELLED") {
        const tcStatus = await getStudentTcRestriction(student.id);
        if (tcStatus.isExpired) {
          hasExpiredStudent = true;
        } else if (tcStatus.isRestricted) {
          hasRestrictedStudent = true;
        }
      }
    }

    if (!hasActiveStudent) {
      if (hasRestrictedStudent) {
        isRestricted = true;
      } else if (hasExpiredStudent) {
        throw new ApiError(403, "Parent access expired");
      } else {
        throw new ApiError(403, "Parent has no active students linked");
      }
    }
  }

  return { isRestricted };
}

function buildOtpRoleCandidates(primaryRoleType: string): OtpEffectiveRole[] {
  const candidates: OtpEffectiveRole[] = [];
  if (primaryRoleType === "STUDENT") candidates.push("STUDENT");
  if (primaryRoleType === "PARENT") candidates.push("PARENT");
  if (!candidates.includes("STUDENT")) candidates.push("STUDENT");
  if (!candidates.includes("PARENT")) candidates.push("PARENT");
  return candidates;
}

async function ensureStudentParentMatch(
  user: { id: string; role: { roleType: string }; schoolId: string },
  studentNumber: string,
  db: DbClient
) {
  const trimmedNumber = studentNumber.trim();

  const student = await db.student.findFirst({
    where: {
      schoolId: user.schoolId,
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        { registrationNumber: trimmedNumber },
        { admissionNumber: trimmedNumber },
      ],
    },
    select: { id: true, userId: true },
  });

  if (!student) {
    throw new ApiError(404, "Student number not found");
  }

  if (user.role.roleType === "STUDENT") {
    if (student.userId !== user.id) {
      throw new ApiError(403, "Student number does not match");
    }
    return;
  }

  if (user.role.roleType === "PARENT") {
    const parent = await db.parent.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const link = await db.parentStudentLink.findFirst({
      where: { parentId: parent.id, studentId: student.id },
      select: { id: true },
    });
    if (!link) {
      throw new ApiError(403, "Student not linked to parent");
    }
    return;
  }

  throw new ApiError(403, "OTP login allowed only for students and parents");
}

async function resolveOtpLoginContext(
  user: {
    id: string;
    role: { roleType: string };
    schoolId: string;
  },
  db: DbClient
): Promise<{ role: { id: string; roleType: OtpEffectiveRole; createdAt: Date }; isRestricted: boolean }> {
  const candidates = buildOtpRoleCandidates(user.role.roleType);
  let lastError: unknown = null;
  let sawOnlyLinkMissing = true;

  for (const candidate of candidates) {
    try {
      const restriction = await ensureOtpRoleLink(user, candidate, db);
      const role = await db.role.findUnique({
        where: { roleType: candidate },
        select: { id: true, roleType: true, createdAt: true },
      });
      if (!role) {
        throw new ApiError(500, `${candidate} role missing`);
      }
      return {
        role: {
          id: role.id,
          roleType: role.roleType as OtpEffectiveRole,
          createdAt: role.createdAt,
        },
        isRestricted: restriction.isRestricted,
      };
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError)) {
        sawOnlyLinkMissing = false;
      } else if (
        error.message !== "Student account not linked" &&
        error.message !== "Parent account not linked"
      ) {
        sawOnlyLinkMissing = false;
      }
    }
  }

  if (sawOnlyLinkMissing) {
    throw new ApiError(403, "OTP login allowed only for students and parents");
  }

  if (lastError) {
    throw lastError;
  }

  throw new ApiError(403, "OTP login allowed only for students and parents");
}

async function getOtpLoginContextOrThrow(
  mobile: string,
  studentNumber: string | undefined,
  db: DbClient
) {
  const user = await db.user.findUnique({
    where: { mobile },
    include: { role: true },
  });

  if (!user) {
    logger.warn(`[AUTH] OTP_SEND failed reason=USER_NOT_FOUND mobile=${mobile}`);
    throw new ApiError(404, "Mobile number not registered");
  }

  if (!user.isActive) {
    logger.warn(`[AUTH] OTP_SEND failed reason=INACTIVE_USER user=${user.id}`);
    throw new ApiError(403, "User account is inactive");
  }

  if (user.mobile !== mobile) {
    throw new ApiError(400, "Invalid phone number");
  }

  if (studentNumber) {
    await ensureStudentParentMatch(user, studentNumber, db);
  }

  try {
    const context = await resolveOtpLoginContext(user, db);
    return { user, context };
  } catch (error) {
    logger.warn(`[AUTH] OTP_SEND failed reason=ROLE_LINK user=${user.id}`);
    throw error;
  }
}

export async function sendOtp(
  mobile: string,
  studentNumber?: string,
  channel?: OtpDeliveryMode
) {
  logger.info(`[AUTH] OTP_SEND attempt mobile=${mobile}`);
  const configuredMode = resolveOtpDeliveryMode();
  if (channel) {
    logger.info(
      `[OTP] requested_delivery=${channel} configured_delivery=${configuredMode} mobile=${mobile}`
    );
  }
  const { otp, boundMobile, userId } = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as DbClient;
    const { user, context } = await getOtpLoginContextOrThrow(mobile, studentNumber, db);
    const boundMobile = user.mobile;

    if (!boundMobile || boundMobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    const existing = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: boundMobile,
        isConsumed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      logger.warn(`[AUTH] OTP_SEND failed reason=LOCKED mobile=${mobile}`);
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    const otp = generateOtp();
    await ensureOtpDeliveryConfigured();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    if (existing) {
      await tx.otpLog.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          mobile: boundMobile,
          otpHash,
          expiresAt,
          attemptCount: 0,
          lockedUntil: null,
          isConsumed: false,
        },
      });
    } else {
      await tx.otpLog.create({
        data: {
          userId: user.id,
          mobile: boundMobile,
          otpHash,
          expiresAt,
          attemptCount: 0,
          isConsumed: false,
        },
      });
    }

    logger.info(`[AUTH] OTP_SEND eligible role=${context.role.roleType} user=${user.id}`);
    return { otp, boundMobile, userId: user.id };
  });

  await sendPhoneOtp(boundMobile, otp, channel);
  logger.info(`[OTP] send success delivery=${configuredMode} mobile=${boundMobile}`);

  logger.info(`[AUTH] OTP_SEND success user=${userId}`);
  return {
    message: "OTP sent successfully",
  };
}

export async function resendOtp(
  mobile: string,
  studentNumber?: string,
  channel?: OtpDeliveryMode
) {
  logger.info(`[AUTH] OTP_RESEND attempt mobile=${mobile}`);
  const configuredMode = resolveOtpDeliveryMode();
  if (channel) {
    logger.info(
      `[OTP] requested_delivery=${channel} configured_delivery=${configuredMode} mobile=${mobile}`
    );
  }
  const { otp, boundMobile, userId } = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as DbClient;
    const { user, context } = await getOtpLoginContextOrThrow(mobile, studentNumber, db);
    const boundMobile = user.mobile;

    if (!boundMobile || boundMobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    const existing = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: boundMobile,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      logger.warn(`[AUTH] OTP_RESEND failed reason=LOCKED mobile=${mobile}`);
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (
      existing?.updatedAt &&
      Date.now() - existing.updatedAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait 30 seconds before resending OTP");
    }

    const otp = generateOtp();
    await ensureOtpDeliveryConfigured();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    if (existing) {
      await tx.otpLog.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          mobile: boundMobile,
          otpHash,
          expiresAt,
          attemptCount: 0,
          lockedUntil: null,
          isConsumed: false,
        },
      });
    } else {
      await tx.otpLog.create({
        data: {
          userId: user.id,
          mobile: boundMobile,
          otpHash,
          expiresAt,
          attemptCount: 0,
          isConsumed: false,
        },
      });
    }

    logger.info(`[AUTH] OTP_RESEND eligible role=${context.role.roleType} user=${user.id}`);
    return { otp, boundMobile, userId: user.id };
  });

  await sendPhoneOtp(boundMobile, otp, channel);
  logger.info(`[OTP] send success delivery=${configuredMode} mobile=${boundMobile}`);

  logger.info(`[AUTH] OTP_RESEND success user=${userId}`);
  return {
    message: "OTP resent successfully",
  };
}

export async function verifyOtp(mobile: string, studentNumber: string | undefined, otp: string) {
  logger.info(`[AUTH] OTP_VERIFY attempt mobile=${mobile}`);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  const refreshToken = uuidv4();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const { user, restricted, effectiveRole } = await prisma.$transaction(async (tx) => {
    const db = tx as unknown as DbClient;
    const user = await tx.user.findUnique({
      where: { mobile },
      include: { role: true },
    });

    if (!user) {
      logger.warn(`[AUTH] OTP_VERIFY failed reason=USER_NOT_FOUND mobile=${mobile}`);
      throw new ApiError(404, "Mobile number not registered");
    }

    if (user.mobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    if (studentNumber) {
      await ensureStudentParentMatch(user, studentNumber, db);
    }

    const record = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: user.mobile,
        isConsumed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!record || record.userId !== user.id || record.mobile !== user.mobile) {
      logger.warn(`[AUTH] OTP_VERIFY failed reason=NO_RECORD mobile=${mobile}`);
      throw new ApiError(400, "Invalid OTP");
    }

    if (record.lockedUntil && record.lockedUntil > new Date()) {
      logger.warn(`[AUTH] OTP_VERIFY failed reason=LOCKED mobile=${mobile}`);
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (record.expiresAt < new Date()) {
      await tx.otpLog.update({
        where: { id: record.id },
        data: { isConsumed: true },
      });

      logger.warn(`[AUTH] OTP_VERIFY failed reason=EXPIRED mobile=${mobile}`);
      throw new ApiError(400, "OTP expired");
    }

    const isOtpValid = await bcrypt.compare(otp, record.otpHash);

    if (!isOtpValid) {
      const attempts = record.attemptCount + 1;
      const shouldLock = attempts >= OTP_MAX_ATTEMPTS;

      await tx.otpLog.update({
        where: { id: record.id },
        data: {
          attemptCount: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + OTP_COOLDOWN_MS) : null,
        },
      });

      const message = shouldLock
        ? "Too many attempts, try after 10 minutes"
        : "Invalid OTP";

      logger.warn(`[AUTH] OTP_VERIFY failed reason=INVALID_OTP mobile=${mobile}`);
      throw new ApiError(400, message);
    }

    if (!user.isActive) {
      logger.warn(`[AUTH] OTP_VERIFY failed reason=INACTIVE_USER user=${user.id}`);
      throw new ApiError(403, "User account is inactive");
    }

    let restriction = { isRestricted: false };
    let context: {
      role: { id: string; roleType: OtpEffectiveRole; createdAt: Date };
      isRestricted: boolean;
    } | null = null;
    try {
      context = await resolveOtpLoginContext(user, db);
      restriction = { isRestricted: context.isRestricted };
    } catch (error) {
      logger.warn(`[AUTH] OTP_VERIFY failed reason=ROLE_LINK user=${user.id}`);
      throw error;
    }
    if (!context) {
      throw new ApiError(500, "OTP login role resolution failed");
    }

    await tx.otpLog.update({
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
        roleId: context.role.id,
        roleType: context.role.roleType,
        expiresAt: getRefreshTokenExpiry(),
        deviceId: null,
        ipAddress: null,
        userAgent: null,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), isMobileVerified: true },
      include: { role: true },
    });

    return {
      user: updatedUser,
      restricted: restriction.isRestricted,
      effectiveRole: context.role,
    };
  });

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: effectiveRole.id,
      roleType: effectiveRole.roleType,
      schoolId: user.schoolId,
    },
    jwtSecret,
    { expiresIn: "15m" }
  );

  logger.info(`[AUTH] OTP_VERIFY success user=${user.id}`);
  logger.info(`[AUTH] OTP_VERIFY role=${effectiveRole.roleType} user=${user.id}`);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    userId: user.id,
    role: effectiveRole.roleType,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      roleId: effectiveRole.id,
      mustChangePassword: user.mustChangePassword,
      phoneVerified: user.isMobileVerified,
      role: effectiveRole,
      restricted,
    },
  };
}
