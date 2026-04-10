import { z } from "zod";

const optionalNonEmpty = z.string().trim().min(1).optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, "phone must contain 10 to 15 digits")
  .optional();

export const teacherBulkImportRowSchema = z
  .object({
    firstName: z.string().trim().min(1, "firstName is required"),
    lastName: z.string().trim().min(1, "lastName is required"),
    email: z.string().trim().email().optional(),
    phone: phoneSchema,
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    qualification: optionalNonEmpty,
    experienceYears: optionalNonEmpty,
    address: optionalNonEmpty,
  })
  .refine((data) => data.email || data.phone, {
    message: "email or phone is required",
    path: ["email"],
  });

export type TeacherBulkImportRowInput = z.infer<typeof teacherBulkImportRowSchema>;
