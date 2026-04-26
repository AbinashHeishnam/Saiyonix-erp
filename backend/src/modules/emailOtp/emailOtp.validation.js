import { z } from "zod";
export const requestEmailOtpSchema = z.object({
    email: z.string().trim().email("email must be a valid email"),
});
export const resendEmailOtpSchema = requestEmailOtpSchema;
export const verifyEmailOtpSchema = z.object({
    email: z.string().trim().email("email must be a valid email"),
    otp: z.string().trim().regex(/^\d{6}$/, "otp must be a 6-digit code"),
});
