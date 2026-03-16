import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import prisma from "../../core/db/prisma";
import { comparePassword, hashPassword } from "../../utils/password";
import { logAudit } from "../../utils/audit";
import { logger } from "../../utils/logger";
import { ApiError } from "../../core/errors/apiError";

type RegisterInput = {
  email: string;
  password: string;
  roleId: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const SCHOOL_CODE = "CSC001";
const LOCK_WINDOW_MINUTES = 10;
const REFRESH_TOKEN_TTL_DAYS = 7;

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

/*
REGISTER USER
*/
export async function registerUser({ email, password, roleId }: RegisterInput) {
  const schoolId = await getDefaultSchoolId();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      schoolId,
      email,
      passwordHash,
      roleId,
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
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  /*
  PREVENT USER ENUMERATION
  */
  if (!user) {
    logger.warn(`[SECURITY] FAILED_LOGIN email=${email}`);
    throw new ApiError(401, "Invalid email or password");
  }

  /*
  OTP accounts cannot use password login
  */
  if (!user.passwordHash) {
    throw new ApiError(400, "Password login not allowed for this account");
  }

  /*
  ACCOUNT LOCK CHECK
  */
  if (user.lockUntil && user.lockUntil > new Date()) {
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

  /*
  SUCCESSFUL LOGIN → RESET COUNTER
  */
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
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

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      deviceId: null,
      ipAddress: null,
      userAgent: null,
      expiresAt,
    },
  });

  logger.info(`[AUTH] LOGIN success user=${user.id}`);

  await logAudit({
    userId: user.id,
    action: "LOGIN",
    entity: "AUTH",
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      schoolId: user.schoolId,
      roleId: user.roleId,
      createdAt: user.createdAt,
      role: user.role,
    },
  };
}

/*
REFRESH ACCESS TOKEN WITH ROTATION
*/
export async function refreshAccessToken(refreshToken: string) {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (session.expiresAt < new Date()) {
    throw new ApiError(401, "Refresh token expired");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  /*
  DELETE OLD SESSION
  */
  await prisma.session.delete({
    where: { refreshToken }
  });

  /*
  CREATE NEW REFRESH TOKEN
  */
  const newRefreshToken = uuidv4();
  const expiresAt = getRefreshTokenExpiry();

  await prisma.session.create({
    data: {
      userId: session.user.id,
      refreshToken: newRefreshToken,
      deviceId: session.deviceId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
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
      roleId: session.user.roleId,
      roleType: session.user.role.roleType,
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

/*
LOGOUT USER
*/
export async function logoutUser(refreshToken: string) {
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token required");
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken },
  });

  if (!session) {
    throw new ApiError(404, "Session not found");
  }

  await prisma.session.delete({
    where: { refreshToken },
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
