import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import prisma from "../../config/prisma";
import { sendOTP } from "../../services/sms.service";
import { ApiError } from "../../utils/apiError";

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_DAYS = 7;

function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function sendOtp(mobile: string) {
  const user = await prisma.user.findUnique({
    where: { mobile },
    include: { role: true },
  });

  if (!user) {
    throw new ApiError(404, "Mobile number not registered");
  }

  if (user.role.roleType !== "STUDENT" && user.role.roleType !== "PARENT") {
    throw new ApiError(403, "OTP login allowed only for students and parents");
  }

  const existing = await prisma.otpLog.findFirst({
    where: {
      mobile,
      isConsumed: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
    throw new ApiError(429, "OTP requests are temporarily locked. Try again later.");
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  if (existing) {
    await prisma.otpLog.update({
      where: { id: existing.id },
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
        attemptCount: 0,
        lockedUntil: null,
        isConsumed: false,
      },
    });
  } else {
    await prisma.otpLog.create({
      data: {
        userId: user.id,
        mobile,
        otpHash,
        expiresAt,
        attemptCount: 0,
      },
    });
  }

  await sendOTP(mobile, otp);

  return {
    message: "OTP sent successfully",
  };
}

export async function verifyOtp(mobile: string, otp: string) {
  const record = await prisma.otpLog.findFirst({
    where: {
      mobile,
      isConsumed: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    throw new ApiError(429, "Too many invalid OTP attempts. Try again later.");
  }

  if (record.expiresAt < new Date()) {
    await prisma.otpLog.update({
      where: { id: record.id },
      data: { isConsumed: true },
    });

    throw new ApiError(400, "OTP expired");
  }

  const isOtpValid = await bcrypt.compare(otp, record.otpHash);

  if (!isOtpValid) {
    const attempts = record.attemptCount + 1;
    const shouldLock = attempts >= OTP_MAX_ATTEMPTS;

    await prisma.otpLog.update({
      where: { id: record.id },
      data: {
        attemptCount: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + OTP_COOLDOWN_MS) : null,
      },
    });

    const message = shouldLock
      ? "Too many invalid OTP attempts. Try again in 15 minutes."
      : "Invalid OTP";

    throw new ApiError(400, message);
  }

  await prisma.otpLog.update({
    where: { id: record.id },
    data: {
      isConsumed: true,
    },
  });

  const user = await prisma.user.findUnique({
    where: { mobile },
    include: { role: true },
  });

  if (!user) {
    throw new ApiError(404, "Mobile number not registered");
  }

  if (user.role.roleType !== "STUDENT" && user.role.roleType !== "PARENT") {
    throw new ApiError(403, "OTP login allowed only for students and parents");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

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

  const refreshToken = uuidv4();

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: getRefreshTokenExpiry(),
      deviceId: null,
      ipAddress: null,
      userAgent: null,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      roleId: user.roleId,
      role: user.role,
    },
  };
}
