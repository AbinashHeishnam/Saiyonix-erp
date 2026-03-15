import { z } from "zod";

const optionalNonEmpty = z.string().trim().min(1).optional();

const optionalIsoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "joiningDate must be a valid ISO date",
  })
  .optional();

export const teacherImportRowSchema = z
  .object({
    fullName: z.string().trim().min(1),
    employeeId: z
      .string()
      .trim()
      .min(1)
      .transform((v) => v.toUpperCase()),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  designation: optionalNonEmpty,
  department: optionalNonEmpty,
  joiningDate: optionalIsoDate,
  qualification: optionalNonEmpty,
  phone: optionalNonEmpty,
  email: z.string().trim().email().optional(),
  address: optionalNonEmpty,
  photoUrl: optionalNonEmpty,
  })
  .strict();

export const teacherImportFileSchema = z.array(teacherImportRowSchema).min(1);
