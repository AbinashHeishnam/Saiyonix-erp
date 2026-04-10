import { z } from "zod";
import { otpChannelSchema } from "@/modules/otp/otp.validation";

const mobileSchema = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, "mobile must contain 10 to 15 digits");

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleType: z.enum(["STUDENT", "PARENT"]).optional().default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().uuid().optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().uuid().optional(),
});

export const setupSendOtpSchema = z.object({
  mobile: mobileSchema,
  channel: otpChannelSchema.optional().default("sms"),
});

export const setupVerifyOtpSchema = z.object({
  mobile: mobileSchema,
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const setupCompleteSchema = z
  .object({
    mobile: mobileSchema,
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const adminSetupCompleteSchema = z
  .object({
    email: z.string().trim().email(),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const adminSetupVerifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const adminSetupSendOtpSchema = z.object({}).optional();

export const passwordResetSendSchema = z.object({
  mobile: mobileSchema,
  channel: otpChannelSchema.optional().default("sms"),
});

export const passwordResetVerifySchema = z.object({
  mobile: mobileSchema,
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const passwordResetSchema = z
  .object({
    resetToken: z.string().min(1),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const teacherIdentifierSchema = z.object({
  identifier: z.string().trim().min(3),
});

export const teacherOtpVerifySchema = z.object({
  identifier: z.string().trim().min(3),
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be 6 digits"),
});

export const teacherPasswordCompleteSchema = z
  .object({
    resetToken: z.string().min(1),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const unlockUserSchema = z
  .object({
    email: z.string().email().optional(),
    mobile: mobileSchema.optional(),
  })
  .refine((data) => data.email || data.mobile, {
    message: "email or mobile is required",
    path: ["email"],
  });
