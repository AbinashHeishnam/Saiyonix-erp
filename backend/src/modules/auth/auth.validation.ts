import { z } from "zod";

const mobileSchema = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, "mobile must contain 10 to 15 digits");

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().uuid(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().uuid(),
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
