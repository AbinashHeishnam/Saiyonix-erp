import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import prisma from "@/core/db/prisma";
import { comparePassword, hashPassword } from "@/utils/password";
import { logAudit } from "@/utils/audit";
import { logger } from "@/utils/logger";
import { ApiError } from "@/core/errors/apiError";
import { updateAuthUserCache } from "@/middleware/auth.middleware";
import { sendPhoneOtp } from "../../services/sms.service";
import { assertOtpDeliveryConfigured } from "@/services/sms/config";
import { env } from "@/config/env";
import { hashRefreshToken } from "@/utils/refreshToken";
import { sendOtpEmail } from "@/services/email/email.service";
import {
  getStudentTcRestriction,
} from "@/modules/auth/tcGuard";

type RegisterInput = {
  email: string;
  password: string;
  roleType: "STUDENT" | "PARENT";
};

type LoginInput = {
  email: string;
  password: string;
};

const SCHOOL_CODE = "CSC001";
const LOCK_WINDOW_MINUTES = 10;
const REFRESH_TOKEN_TTL_DAYS = 7;
const SETUP_OTP_EXPIRY_MS = 5 * 60 * 1000;
const SETUP_OTP_MAX_ATTEMPTS = 3;
const SETUP_OTP_LOCK_MS = 10 * 60 * 1000;
const SETUP_OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const PASSWORD_RESET_OTP_EXPIRY_MS = 5 * 60 * 1000;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_OTP_LOCK_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const ADMIN_SETUP_OTP_EXPIRY_MS = env.EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000;
const ADMIN_SETUP_OTP_RESEND_COOLDOWN_MS = env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;

const ADMIN_SETUP_ALLOWED_ROLES = new Set([
  "ADMIN",
  "ACADEMIC_SUB_ADMIN",
  "FINANCE_SUB_ADMIN",
  "TEACHER",
]);

type RoleTypeValue =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ACADEMIC_SUB_ADMIN"
  | "FINANCE_SUB_ADMIN"
  | "TEACHER"
  | "PARENT"
  | "STUDENT";

const TEACHER_ACTIVATION_PURPOSE = "TEACHER_ACTIVATE";
const TEACHER_RESET_PURPOSE = "TEACHER_RESET";

const userSelect = {
  id: true,
  email: true,
  roleId: true,
  schoolId: true,
  createdAt: true,
  role: {
    select: {
      id: true,
      roleType: true,
      createdAt: true,
    },
  },
} as const;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function ensureOtpDeliveryConfigured() {
  if (process.env.NODE_ENV === "production") {
    await assertOtpDeliveryConfigured();
  }
}

type DbClient = typeof prisma;

async function ensureRoleLink(
  user: {
  id: string;
  role: { roleType: string };
  schoolId: string;
},
  db: DbClient = prisma
): Promise<{ isRestricted: boolean }> {
  let isRestricted = false;
  if (user.role.roleType === "TEACHER") {
    const teacher = await db.teacher.findFirst({
      where: { userId: user.id, schoolId: user.schoolId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
    if (teacher.status !== "ACTIVE") {
      throw new ApiError(403, "Teacher account is not active");
    }
  }

  if (user.role.roleType === "STUDENT") {
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

  if (user.role.roleType === "PARENT") {
    const parent = await db.parent.findFirst({
      where: { userId: user.id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }
    const link = await db.parentStudentLink.findFirst({
      where: {
        parentId: parent.id,
        student: { schoolId: user.schoolId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }

    const links = await db.parentStudentLink.findMany({
      where: {
        parentId: parent.id,
        student: { schoolId: user.schoolId, deletedAt: null },
      },
      select: {
        student: { select: { id: true, status: true } },
      },
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

let cachedSchoolId: string | null = null;

async function getDefaultSchoolId() {
  if (cachedSchoolId) {
    return cachedSchoolId;
  }

  const school = await prisma.school.findUnique({
    where: { code: SCHOOL_CODE },
    select: { id: true },
  });

  if (!school) {
    throw new ApiError(500, `Default school not found for code ${SCHOOL_CODE}`);
  }

  cachedSchoolId = school.id;
  return school.id;
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueAuthTokens(user: {
  id: string;
  email: string | null;
  roleId: string;
  schoolId: string;
  role: { roleType: string };
}) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleType: user.role.roleType as RoleTypeValue,
      schoolId: user.schoolId,
    },
    jwtSecret,
    { expiresIn: "15m" }
  );

  const refreshToken = uuidv4();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      roleId: user.roleId,
      roleType: user.role.roleType as RoleTypeValue,
      deviceId: null,
      ipAddress: null,
      userAgent: null,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
}

async function getTeacherForSetup(userId: string, db: DbClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (user.role.roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can complete setup");
  }

  if (!user.isActive) {
    throw new ApiError(403, "User account is inactive");
  }

  await ensureRoleLink(user, db);

  return user;
}

async function getAdminForSetup(userId: string, db: DbClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!ADMIN_SETUP_ALLOWED_ROLES.has(user.role.roleType)) {
    throw new ApiError(403, "Only admin users can complete setup");
  }

  if (!user.isActive) {
    throw new ApiError(403, "User account is inactive");
  }

  return user;
}

function parseTeacherIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    return { channel: "email" as const, value: trimmed.toLowerCase() };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(digits)) {
    throw new ApiError(400, "Invalid identifier");
  }
  return { channel: "phone" as const, value: digits };
}

async function getTeacherByIdentifier(
  identifier: string,
  db: DbClient = prisma
): Promise<{
  user: Prisma.UserGetPayload<{ include: { role: true } }>;
  channel: "email" | "phone";
  value: string;
} | null> {
  const parsed = parseTeacherIdentifier(identifier);
  const where =
    parsed.channel === "email"
      ? { email: { equals: parsed.value, mode: Prisma.QueryMode.insensitive } }
      : { mobile: parsed.value };
  const user: Prisma.UserGetPayload<{ include: { role: true } }> | null =
    await db.user.findFirst({
      where: { ...where, isActive: true, role: { roleType: "TEACHER" } },
      include: { role: true },
    });
  if (!user) return null;

  const teacher = await db.teacher.findFirst({
    where: { userId: user.id, schoolId: user.schoolId, deletedAt: null },
    select: { status: true },
  });
  if (!teacher || teacher.status !== "ACTIVE") return null;

  return { user, channel: parsed.channel, value: parsed.value };
}

async function deliverEmailOtpForTeacher(email: string, otp: string, purpose: string) {
  await sendOtpEmail({
    to: email,
    otp,
    purpose,
    expiresInMinutes: Math.ceil(PASSWORD_RESET_OTP_EXPIRY_MS / 60000),
  });
}

async function deliverAdminSetupEmailOtp(email: string, otp: string) {
  await sendOtpEmail({
    to: email,
    otp,
    purpose: "ADMIN_SETUP",
    expiresInMinutes: env.EMAIL_OTP_EXPIRY_MINUTES,
  });
}

async function upsertTeacherEmailOtp(params: {
  db: DbClient;
  email: string;
  userId: string;
  purpose: string;
  expiresAt: Date;
  otpHash: string;
  existingId?: string;
  now: Date;
}) {
  const { db, existingId, email, userId, purpose, expiresAt, otpHash, now } = params;
  if (existingId) {
    await db.emailOtpLog.update({
      where: { id: existingId },
      data: {
        userId,
        email,
        purpose,
        otpHash,
        expiresAt,
        attemptCount: 0,
        lockedUntil: null,
        isConsumed: false,
        lastSentAt: now,
      },
    });
    return;
  }

  await db.emailOtpLog.create({
    data: {
      userId,
      email,
      purpose,
      otpHash,
      expiresAt,
      attemptCount: 0,
      lockedUntil: null,
      isConsumed: false,
      lastSentAt: now,
    },
  });
}

async function ensureMobileAvailable(
  userId: string,
  mobile: string,
  db: DbClient = prisma
) {
  const existing = await db.user.findFirst({
    where: {
      mobile,
      id: { not: userId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Mobile number already in use");
  }
}

/*
REGISTER USER
*/
export async function registerUser({ email, password, roleType }: RegisterInput) {
  const schoolId = await getDefaultSchoolId();
  const passwordHash = await hashPassword(password);

  const role = await prisma.role.findUnique({
    where: { roleType },
    select: { id: true },
  });
  if (!role) {
    throw new ApiError(500, "Registration role not configured");
  }

  const user = await prisma.user.create({
    data: {
      schoolId,
      email,
      passwordHash,
      roleId: role.id,
    },
    select: userSelect,
  });

  logger.info(`[AUTH] REGISTER user=${user.id}`);

  await logAudit({
    userId: user.id,
    action: "REGISTER",
    entity: "AUTH",
  });

  return user;
}

/*
LOGIN USER
*/
export async function loginUser({ email, password }: LoginInput) {
  logger.info(`[AUTH] LOGIN attempt email=${email}`);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  /*
  PREVENT USER ENUMERATION
  */
  if (!user) {
    logger.warn(`[AUTH] LOGIN failed reason=USER_NOT_FOUND email=${email}`);
    logger.warn(`[SECURITY] FAILED_LOGIN email=${email}`);
    throw new ApiError(401, "Invalid email or password");
  }

  /*
  OTP accounts cannot use password login
  */
  if (!user.passwordHash) {
    logger.warn(`[AUTH] LOGIN failed reason=PASSWORD_NOT_ALLOWED user=${user.id}`);
    throw new ApiError(400, "Password login not allowed for this account");
  }

  /*
  ACCOUNT LOCK CHECK
  */
  if (user.lockUntil && user.lockUntil > new Date()) {
    logger.warn(`[AUTH] LOGIN failed reason=ACCOUNT_LOCKED user=${user.id}`);
    throw new ApiError(
      423,
      "Account temporarily locked due to multiple failed login attempts"
    );
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  /*
  WRONG PASSWORD
  */
  if (!isPasswordValid) {
    logger.warn(`[AUTH] LOGIN failed reason=INVALID_PASSWORD user=${user.id}`);

    const attempts = user.failedLoginAttempts + 1;

    /*
    LOCK AFTER 5 FAILURES
    */
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + LOCK_WINDOW_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockUntil,
        },
      });

      logger.warn(`[SECURITY] ACCOUNT_LOCKED user=${user.id}`);

      await logAudit({
        userId: user.id,
        action: "ACCOUNT_LOCKED",
        entity: "AUTH",
      });

      throw new ApiError(
        423,
        "Account locked for 10 minutes due to multiple failed login attempts"
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
      },
    });

    logger.warn(`[SECURITY] FAILED_LOGIN user=${user.id}`);

    await logAudit({
      userId: user.id,
      action: "FAILED_LOGIN",
      entity: "AUTH",
    });

    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    logger.warn(`[AUTH] LOGIN failed reason=INACTIVE_USER user=${user.id}`);
    throw new ApiError(403, "User account is inactive");
  }

  let restriction = { isRestricted: false };
  try {
    restriction = await ensureRoleLink(user);
  } catch (error) {
    logger.warn(`[AUTH] LOGIN failed reason=ROLE_LINK user=${user.id}`);
    throw error;
  }

  /*
  SUCCESSFUL LOGIN → RESET COUNTER
  */
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  /*
  ACCESS TOKEN
  */
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

  /*
  REFRESH TOKEN
  */
  const refreshToken = uuidv4();
  const expiresAt = getRefreshTokenExpiry();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      roleId: user.roleId,
      roleType: user.role.roleType,
      deviceId: null,
      ipAddress: null,
      userAgent: null,
      expiresAt,
    },
  });

  logger.info(`[AUTH] LOGIN success user=${user.id}`);
  logger.info(`[AUTH] LOGIN role=${user.role.roleType} user=${user.id}`);

  await logAudit({
    userId: user.id,
    action: "LOGIN",
    entity: "AUTH",
  });

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
      schoolId: user.schoolId,
      roleId: user.roleId,
      mustChangePassword: user.mustChangePassword,
      phoneVerified: user.isMobileVerified,
      createdAt: user.createdAt,
      role: user.role,
      restricted: restriction.isRestricted,
    },
  };
}

/*
REFRESH ACCESS TOKEN WITH ROTATION
*/
export async function refreshAccessToken(refreshToken: string) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (!session.user.isActive) {
    throw new ApiError(403, "User account is inactive");
  }

  if (session.expiresAt < new Date()) {
    throw new ApiError(401, "Refresh token expired");
  }

  const effectiveRoleType = session.roleType ?? session.user.role.roleType;
  const effectiveRoleId = session.roleId ?? session.user.roleId;

  if (effectiveRoleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: session.user.id, schoolId: session.user.schoolId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (student?.status === "EXPELLED") {
      const tcStatus = await getStudentTcRestriction(student.id);
      if (tcStatus.isExpired) {
        throw new ApiError(403, "Account disabled permanently");
      }
    }
  }

  if (effectiveRoleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { userId: session.user.id, schoolId: session.user.schoolId },
      select: {
        id: true,
        studentLinks: {
          where: { student: { schoolId: session.user.schoolId, deletedAt: null } },
          select: { student: { select: { id: true, status: true } } },
        },
      },
    });
    if (parent?.studentLinks?.length) {
      let hasActiveStudent = false;
      let hasRestrictedStudent = false;
      let hasExpiredStudent = false;

      for (const link of parent.studentLinks) {
        const student = link.student;
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

      if (!hasActiveStudent && !hasRestrictedStudent && hasExpiredStudent) {
        throw new ApiError(403, "Parent access expired");
      }
    }
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  /*
  DELETE OLD SESSION
  */
  await prisma.session.delete({
    where: { refreshTokenHash }
  });

  /*
  CREATE NEW REFRESH TOKEN
  */
  const newRefreshToken = uuidv4();
  const expiresAt = getRefreshTokenExpiry();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  await prisma.session.create({
    data: {
      userId: session.user.id,
      refreshTokenHash: newRefreshTokenHash,
      deviceId: session.deviceId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      roleId: effectiveRoleId,
      roleType: effectiveRoleType,
      expiresAt,
    },
  });

  /*
  NEW ACCESS TOKEN
  */
  const accessToken = jwt.sign(
    {
      sub: session.user.id,
      email: session.user.email,
      roleId: effectiveRoleId,
      roleType: effectiveRoleType,
      schoolId: session.user.schoolId,
    },
    jwtSecret,
    { expiresIn: "15m" }
  );

  logger.info(`[AUTH] TOKEN_REFRESH user=${session.user.id}`);

  return {
    accessToken,
    refreshToken: newRefreshToken
  };
}

export async function sendTeacherSetupOtp(
  userId: string,
  mobile: string
) {
  logger.info(`[AUTH] SETUP_OTP_SEND attempt user=${userId}`);
  const { otp, boundMobile } = await prisma.$transaction(async (tx) => {
    const user = await getTeacherForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword && user.isMobileVerified) {
      throw new ApiError(400, "Account setup already completed");
    }

    if (user.mobile && user.mobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    await ensureMobileAvailable(user.id, mobile, tx as DbClient);

    const boundMobile = user.mobile ?? mobile;

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
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (
      existing?.updatedAt &&
      Date.now() - existing.updatedAt.getTime() < SETUP_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait 30 seconds before resending OTP");
    }

    const otp = generateOtp();
    await ensureOtpDeliveryConfigured();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + SETUP_OTP_EXPIRY_MS);

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

    return { otp, boundMobile };
  });

  await sendPhoneOtp(boundMobile, otp);

  return {
    message: "OTP sent successfully",
  };
}

export async function sendAdminSetupOtp(userId: string) {
  logger.info(`[AUTH] ADMIN_SETUP_OTP_SEND attempt user=${userId}`);
  const { otp, email } = await prisma.$transaction(async (tx) => {
    const user = await getAdminForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword) {
      throw new ApiError(400, "Account setup already completed");
    }

    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new ApiError(400, "Email is required for setup");
    }

    const existing = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: "LOGIN",
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (
      existing?.lastSentAt &&
      Date.now() - existing.lastSentAt.getTime() < ADMIN_SETUP_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + ADMIN_SETUP_OTP_EXPIRY_MS);
    const now = new Date();

    if (existing) {
      await tx.emailOtpLog.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          email: normalizedEmail,
          purpose: "LOGIN",
          otpHash,
          expiresAt,
          attemptCount: 0,
          lockedUntil: null,
          isConsumed: false,
          lastSentAt: now,
        },
      });
    } else {
      await tx.emailOtpLog.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          purpose: "LOGIN",
          otpHash,
          expiresAt,
          attemptCount: 0,
          lockedUntil: null,
          isConsumed: false,
          lastSentAt: now,
        },
      });
    }

    return { otp, email: normalizedEmail };
  });

  await deliverAdminSetupEmailOtp(email, otp);

  return {
    message: "OTP sent to your email",
  };
}

export async function verifyTeacherSetupOtp(userId: string, mobile: string, otp: string) {
  logger.info(`[AUTH] SETUP_OTP_VERIFY attempt user=${userId}`);
  await prisma.$transaction(async (tx) => {
    const user = await getTeacherForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword && user.isMobileVerified) {
      throw new ApiError(400, "Account setup already completed");
    }

    if (user.mobile && user.mobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    await ensureMobileAvailable(user.id, mobile, tx as DbClient);

    const boundMobile = user.mobile ?? mobile;

    const record = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: boundMobile,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new ApiError(400, "Invalid OTP");
    }

    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (record.expiresAt < new Date()) {
      await tx.otpLog.update({
        where: { id: record.id },
        data: { isConsumed: true },
      });
      throw new ApiError(400, "OTP expired");
    }

    const isOtpValid = await bcrypt.compare(otp, record.otpHash);

    if (!isOtpValid) {
      const attempts = record.attemptCount + 1;
      const shouldLock = attempts >= SETUP_OTP_MAX_ATTEMPTS;

      await tx.otpLog.update({
        where: { id: record.id },
        data: {
          attemptCount: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + SETUP_OTP_LOCK_MS) : null,
        },
      });

      const message = shouldLock
        ? "Too many attempts, try after 10 minutes"
        : "Invalid OTP";

      throw new ApiError(400, message);
    }

    await tx.otpLog.update({
      where: { id: record.id },
      data: {
        isConsumed: true,
        attemptCount: 0,
        lockedUntil: null,
      },
    });
  });

  return { message: "OTP verified successfully" };
}

export async function completeTeacherSetup(params: {
  userId: string;
  mobile: string;
  newPassword: string;
}) {
  const { userId, mobile, newPassword } = params;
  logger.info(`[AUTH] SETUP_COMPLETE attempt user=${userId}`);
  const user = await prisma.$transaction(async (tx) => {
    const user = await getTeacherForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword && user.isMobileVerified) {
      throw new ApiError(400, "Account setup already completed");
    }

    if (user.mobile && user.mobile !== mobile) {
      throw new ApiError(400, "Invalid phone number");
    }

    await ensureMobileAvailable(user.id, mobile, tx as DbClient);

    const boundMobile = user.mobile ?? mobile;

    const otpRecord = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: boundMobile,
        isConsumed: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      throw new ApiError(400, "OTP verification required");
    }

    if (user.passwordHash) {
      const isSamePassword = await comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new ApiError(400, "New password cannot be the same as current password");
      }
    }

    const passwordHash = await hashPassword(newPassword);

    return tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mobile: boundMobile,
        mustChangePassword: false,
        isMobileVerified: true,
      },
    });
  });

  await logAudit({
    userId: user.id,
    action: "SETUP_COMPLETE",
    entity: "AUTH",
  });

  await updateAuthUserCache(user.id, {
    mustChangePassword: false,
    isMobileVerified: true,
    isActive: user.isActive,
  });

  return { message: "Account setup completed" };
}

export async function verifyAdminFirstLoginOtp(params: {
  userId: string;
  email: string;
  otp: string;
}) {
  const { userId, email, otp } = params;
  const normalizedEmail = email.trim().toLowerCase();
  logger.info(`[AUTH] ADMIN_SETUP_OTP_VERIFY attempt user=${userId}`);

  await prisma.$transaction(async (tx) => {
    const user = await getAdminForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword) {
      throw new ApiError(400, "Account setup already completed");
    }

    if (!user.email || user.email.toLowerCase() !== normalizedEmail) {
      throw new ApiError(400, "Invalid email address");
    }

    const otpRecord = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: "LOGIN",
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      throw new ApiError(400, "OTP verification required");
    }

    if (otpRecord.expiresAt < new Date()) {
      await tx.emailOtpLog.update({
        where: { id: otpRecord.id },
        data: { isConsumed: true },
      });
      throw new ApiError(400, "OTP expired");
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) {
      const attempts = otpRecord.attemptCount + 1;
      const shouldBlock = attempts >= SETUP_OTP_MAX_ATTEMPTS;

      await tx.emailOtpLog.update({
        where: { id: otpRecord.id },
        data: {
          attemptCount: attempts,
          isConsumed: shouldBlock ? true : otpRecord.isConsumed,
        },
      });

      throw new ApiError(
        400,
        shouldBlock ? "Too many attempts, request a new OTP" : "Invalid OTP"
      );
    }

    await tx.emailOtpLog.update({
      where: { id: otpRecord.id },
      data: {
        isConsumed: true,
        attemptCount: 0,
        lockedUntil: null,
      },
    });

    return;
  });

  return { message: "OTP verified successfully" };
}

export async function completeAdminFirstLogin(params: {
  userId: string;
  email: string;
  newPassword: string;
}) {
  const { userId, email, newPassword } = params;
  const normalizedEmail = email.trim().toLowerCase();
  logger.info(`[AUTH] ADMIN_SETUP_COMPLETE attempt user=${userId}`);

  const user = await prisma.$transaction(async (tx) => {
    const user = await getAdminForSetup(userId, tx as DbClient);

    if (!user.mustChangePassword) {
      throw new ApiError(400, "Account setup already completed");
    }

    if (!user.email || user.email.toLowerCase() !== normalizedEmail) {
      throw new ApiError(400, "Invalid email address");
    }

    const otpRecord = await tx.emailOtpLog.findFirst({
      where: {
        email: normalizedEmail,
        purpose: "LOGIN",
        isConsumed: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!otpRecord) {
      throw new ApiError(400, "OTP verification required");
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new ApiError(400, "OTP expired");
    }

    if (user.passwordHash) {
      const isSamePassword = await comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new ApiError(400, "New password cannot be the same as current password");
      }
    }

    const passwordHash = await hashPassword(newPassword);

    return tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        lastLoginAt: new Date(),
      },
      include: { role: true },
    });
  });

  const tokens = await issueAuthTokens({
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    schoolId: user.schoolId,
    role: user.role,
  });

  await updateAuthUserCache(user.id, {
    mustChangePassword: false,
    isMobileVerified: user.isMobileVerified ?? false,
    isActive: user.isActive,
  });

  await logAudit({
    userId: user.id,
    action: "ADMIN_SETUP_COMPLETE",
    entity: "AUTH",
  });

  return {
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userId: user.id,
    role: user.role.roleType,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      schoolId: user.schoolId,
      roleId: user.roleId,
      mustChangePassword: user.mustChangePassword,
      phoneVerified: user.isMobileVerified,
      createdAt: user.createdAt,
      role: user.role,
      restricted: false,
    },
  };
}

async function requestTeacherOtp(
  identifier: string,
  purpose: string,
  options?: { strictEmailLookup?: boolean; strictLookup?: boolean }
) {
  const parsed = parseTeacherIdentifier(identifier);
  logger.info(`[AUTH] TEACHER_OTP_SEND attempt ${parsed.channel}=${parsed.value}`);

  const result = await prisma.$transaction(async (tx) => {
    const found = await getTeacherByIdentifier(identifier, tx as DbClient);
    if (!found) {
      if (options?.strictLookup) {
        throw new ApiError(404, "Teacher account not found");
      }
      if (options?.strictEmailLookup && parsed.channel === "email") {
        throw new ApiError(404, "Email not registered");
      }
      return { sent: false, channel: parsed.channel, value: parsed.value };
    }

    const { user, channel, value } = found;

    if (purpose === TEACHER_ACTIVATION_PURPOSE && !user.mustChangePassword && user.passwordHash) {
      return { sent: false, channel, value };
    }

    if (channel === "email") {
      const existing = await tx.emailOtpLog.findFirst({
        where: { email: value, purpose, isConsumed: false },
        orderBy: { createdAt: "desc" },
      });

      if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
        throw new ApiError(429, "Too many attempts, try again later");
      }

      if (
        existing?.lastSentAt &&
        Date.now() - existing.lastSentAt.getTime() < PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS
      ) {
        throw new ApiError(429, "Please wait before requesting a new OTP");
      }

      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MS);
      const now = new Date();

      await upsertTeacherEmailOtp({
        db: tx as DbClient,
        email: value,
        userId: user.id,
        purpose,
        otpHash,
        expiresAt,
        now,
        existingId: existing?.id,
      });

      return { sent: true, channel, value, otp };
    }

    const boundMobile = user.mobile ?? value;

    if (user.mobile && user.mobile !== boundMobile) {
      return { sent: false, channel, value };
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
      throw new ApiError(429, "Too many attempts, try again later");
    }

    if (
      existing?.updatedAt &&
      Date.now() - existing.updatedAt.getTime() < PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MS);

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

    return { sent: true, channel, value: boundMobile, otp };
  });

  if (!result.sent) {
    return { message: "If the account exists, an OTP has been sent" };
  }

  const deliveryValue = result.value;
  const deliveryOtp = result.otp;
  if (!deliveryValue || !deliveryOtp) {
    throw new ApiError(500, "OTP delivery target missing");
  }
  if (result.channel === "email") {
    await deliverEmailOtpForTeacher(deliveryValue, deliveryOtp, purpose);
  } else {
    await ensureOtpDeliveryConfigured();
    await sendPhoneOtp(deliveryValue, deliveryOtp);
  }

  return { message: "If the account exists, an OTP has been sent" };
}

async function verifyTeacherOtp(identifier: string, otp: string, purpose: string) {
  const parsed = parseTeacherIdentifier(identifier);
  logger.info(`[AUTH] TEACHER_OTP_VERIFY attempt ${parsed.channel}=${parsed.value}`);

  const resetToken = await prisma.$transaction(async (tx) => {
    const found = await getTeacherByIdentifier(identifier, tx as DbClient);
    if (!found) {
      throw new ApiError(400, "Invalid OTP");
    }
    const { user, channel, value } = found;

    if (channel === "email") {
      const record = await tx.emailOtpLog.findFirst({
        where: { email: value, purpose, isConsumed: false },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
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
        const shouldBlock = attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;
        await tx.emailOtpLog.update({
          where: { id: record.id },
          data: {
            attemptCount: attempts,
            isConsumed: shouldBlock ? true : record.isConsumed,
          },
        });
        throw new ApiError(
          400,
          shouldBlock ? "Too many attempts, request a new OTP" : "Invalid OTP"
        );
      }

      await tx.emailOtpLog.update({
        where: { id: record.id },
        data: { isConsumed: true, attemptCount: 0, lockedUntil: null },
      });
    } else {
      const record = await tx.otpLog.findFirst({
        where: { userId: user.id, mobile: value, isConsumed: false },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
        throw new ApiError(400, "Invalid OTP");
      }

      if (record.lockedUntil && record.lockedUntil > new Date()) {
        throw new ApiError(429, "Too many attempts, try again later");
      }

      if (record.expiresAt < new Date()) {
        await tx.otpLog.update({
          where: { id: record.id },
          data: { isConsumed: true },
        });
        throw new ApiError(400, "OTP expired");
      }

      const isOtpValid = await bcrypt.compare(otp, record.otpHash);
      if (!isOtpValid) {
        const attempts = record.attemptCount + 1;
        const shouldLock = attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;
        await tx.otpLog.update({
          where: { id: record.id },
          data: {
            attemptCount: attempts,
            lockedUntil: shouldLock ? new Date(Date.now() + PASSWORD_RESET_OTP_LOCK_MS) : null,
          },
        });
        throw new ApiError(400, shouldLock ? "Too many attempts, try after 10 minutes" : "Invalid OTP");
      }

      await tx.otpLog.update({
        where: { id: record.id },
        data: { isConsumed: true, attemptCount: 0, lockedUntil: null },
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new ApiError(500, "JWT_SECRET is not configured");
    }

    return jwt.sign(
      {
        sub: user.id,
        type: purpose,
        channel,
        identifier: value,
      },
      jwtSecret,
      { expiresIn: "10m" }
    );
  });

  return { resetToken };
}

async function completeTeacherPassword(resetToken: string, expectedPurpose: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  let decoded: any;
  try {
    decoded = jwt.verify(resetToken, jwtSecret);
  } catch {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  if (!decoded?.sub || decoded.type !== expectedPurpose) {
    throw new ApiError(400, "Invalid reset token");
  }

  const user = await prisma.user.findFirst({
    where: { id: decoded.sub, isActive: true, role: { roleType: "TEACHER" } },
    include: { role: true },
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, schoolId: user.schoolId, deletedAt: null },
    select: { status: true },
  });
  if (!teacher || teacher.status !== "ACTIVE") {
    throw new ApiError(403, "Teacher account is not active");
  }

  return { user, decoded };
}

export async function requestTeacherActivationOtp(identifier: string) {
  return requestTeacherOtp(identifier, TEACHER_ACTIVATION_PURPOSE, {
    strictEmailLookup: true,
  });
}

export async function verifyTeacherActivationOtp(identifier: string, otp: string) {
  return verifyTeacherOtp(identifier, otp, TEACHER_ACTIVATION_PURPOSE);
}

export async function completeTeacherActivation(resetToken: string, newPassword: string) {
  const { user, decoded } = await completeTeacherPassword(
    resetToken,
    TEACHER_ACTIVATION_PURPOSE
  );

  if (user.passwordHash) {
    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new ApiError(400, "New password cannot be the same as current password");
    }
  }

  const passwordHash = await hashPassword(newPassword);
  const update: any = {
    passwordHash,
    mustChangePassword: false,
  };

  if (decoded?.channel === "phone") {
    update.mobile = user.mobile ?? decoded.identifier;
  }

  // Mark onboarding as complete for teacher activation regardless of channel.
  update.isMobileVerified = true;

  await prisma.user.update({
    where: { id: user.id },
    data: update,
  });

  await logAudit({
    userId: user.id,
    action: "TEACHER_ACTIVATION_COMPLETE",
    entity: "AUTH",
  });

  return { message: "Password setup completed" };
}

export async function requestTeacherForgotPasswordOtp(identifier: string) {
  return requestTeacherOtp(identifier, TEACHER_RESET_PURPOSE, { strictLookup: true });
}

export async function verifyTeacherForgotPasswordOtp(identifier: string, otp: string) {
  return verifyTeacherOtp(identifier, otp, TEACHER_RESET_PURPOSE);
}

export async function completeTeacherForgotPassword(resetToken: string, newPassword: string) {
  const { user } = await completeTeacherPassword(resetToken, TEACHER_RESET_PURPOSE);

  if (user.passwordHash) {
    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new ApiError(400, "New password cannot be the same as current password");
    }
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await logAudit({
    userId: user.id,
    action: "TEACHER_PASSWORD_RESET",
    entity: "AUTH",
  });

  return { message: "Password reset successful" };
}

export async function sendPasswordResetOtpForMobile(
  mobile: string
) {
  const normalizedMobile = mobile.trim();
  logger.info(`[AUTH] PASSWORD_RESET_OTP_SEND mobile=${normalizedMobile}`);

  const user = await prisma.user.findFirst({
    where: { mobile: normalizedMobile, isActive: true, role: { roleType: "TEACHER" } },
    select: { id: true, mobile: true },
  });

  if (!user || !user.mobile) {
    return { message: "If the account exists, an OTP has been sent" };
  }

  const { otp, boundMobile } = await prisma.$transaction(async (tx) => {
    const existing = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: user.mobile!,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (
      existing?.updatedAt &&
      Date.now() - existing.updatedAt.getTime() < PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new ApiError(429, "Please wait 30 seconds before resending OTP");
    }

    const otp = generateOtp();
    await ensureOtpDeliveryConfigured();

    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MS);

    if (existing) {
      await tx.otpLog.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          mobile: user.mobile!,
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
          mobile: user.mobile!,
          otpHash,
          expiresAt,
          attemptCount: 0,
          isConsumed: false,
        },
      });
    }

    return { otp, boundMobile: user.mobile! };
  });

  await sendPhoneOtp(boundMobile, otp);

  return {
    message: "If the account exists, an OTP has been sent",
  };
}

export async function verifyPasswordResetOtpForMobile(mobile: string, otp: string) {
  const normalizedMobile = mobile.trim();
  logger.info(`[AUTH] PASSWORD_RESET_OTP_VERIFY mobile=${normalizedMobile}`);

  const user = await prisma.user.findFirst({
    where: { mobile: normalizedMobile, isActive: true, role: { roleType: "TEACHER" } },
    select: { id: true, mobile: true },
  });
  if (!user || !user.mobile) {
    throw new ApiError(400, "Invalid OTP");
  }

  const resetToken = await prisma.$transaction(async (tx) => {
    const record = await tx.otpLog.findFirst({
      where: {
        userId: user.id,
        mobile: user.mobile!,
        isConsumed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new ApiError(400, "Invalid OTP");
    }

    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many attempts, try after 10 minutes");
    }

    if (record.expiresAt < new Date()) {
      await tx.otpLog.update({
        where: { id: record.id },
        data: { isConsumed: true },
      });
      throw new ApiError(400, "OTP expired");
    }

    const isOtpValid = await bcrypt.compare(otp, record.otpHash);
    if (!isOtpValid) {
      const attempts = record.attemptCount + 1;
      const shouldLock = attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;
      await tx.otpLog.update({
        where: { id: record.id },
        data: {
          attemptCount: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + PASSWORD_RESET_OTP_LOCK_MS) : null,
        },
      });
      throw new ApiError(400, shouldLock ? "Too many attempts, try after 10 minutes" : "Invalid OTP");
    }

    await tx.otpLog.update({
      where: { id: record.id },
      data: {
        isConsumed: true,
        attemptCount: 0,
        lockedUntil: null,
      },
    });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new ApiError(500, "JWT_SECRET is not configured");
    }

    return jwt.sign(
      {
        sub: user.id,
        type: "PASSWORD_RESET",
      },
      jwtSecret,
      { expiresIn: "10m" }
    );
  });

  return { resetToken };
}

export async function resetPasswordWithToken(resetToken: string, newPassword: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  let decoded: any;
  try {
    decoded = jwt.verify(resetToken, jwtSecret);
  } catch {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  if (!decoded?.sub || decoded.type !== "PASSWORD_RESET") {
    throw new ApiError(400, "Invalid reset token");
  }

  const user = await prisma.user.findFirst({
    where: { id: decoded.sub, isActive: true, role: { roleType: "TEACHER" } },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.passwordHash) {
    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new ApiError(400, "New password cannot be the same as current password");
    }
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await logAudit({
    userId: user.id,
    action: "PASSWORD_RESET",
    entity: "AUTH",
  });

  return { message: "Password reset successful" };
}

/*
LOGOUT USER
*/
export async function logoutUser(refreshToken: string) {
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token required");
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
  });

  if (!session) {
    throw new ApiError(404, "Session not found");
  }

  await prisma.session.delete({
    where: { refreshTokenHash },
  });

  logger.info(`[AUTH] LOGOUT user=${session.userId}`);

  await logAudit({
    userId: session.userId,
    action: "LOGOUT",
    entity: "AUTH",
  });

  return {
    message: "Logged out successfully",
  };
}

export async function listUserSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceId: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return sessions;
}

export async function logoutAllSessions(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });

  await logAudit({
    userId,
    action: "LOGOUT_ALL",
    entity: "AUTH",
  });

  return { message: "All sessions revoked successfully" };
}

export async function unlockUserAccount(params: { email?: string; mobile?: string }) {
  const { email, mobile } = params;
  if (!email && !mobile) {
    throw new ApiError(400, "email or mobile is required");
  }

  const orClauses: Array<{ email?: string; mobile?: string }> = [];
  if (email) {
    orClauses.push({ email });
  }
  if (mobile) {
    orClauses.push({ mobile });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: orClauses,
    },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  await logAudit({
    userId: user.id,
    action: "ACCOUNT_UNLOCKED",
    entity: "AUTH",
  });

  return { message: "User account unlocked successfully" };
}
