import { z } from "zod";

export const sendOtpSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "mobile must contain 10 to 15 digits"),
});

export const verifyOtpSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "mobile must contain 10 to 15 digits"),
  otp: z.string().trim().regex(/^\d{6}$/, "otp must be a 6-digit code"),
});
