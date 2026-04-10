import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const teacherIdSchema = z.string().uuid();
export const teacherIdParamSchema = z.object({ id: teacherIdSchema }).strict();
export const listTeacherQuerySchema = paginationQuerySchema.extend({
  academicYearId: z.string().uuid().optional(),
});

export const createTeacherSchema = z.object({
  employeeId: z.string().trim().min(1, "employeeId is required"),
  fullName: z.string().trim().min(1, "fullName is required"),
  designation: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  joiningDate: z.coerce.date().optional(),
});

export const updateTeacherSchema = z
  .object({
    employeeId: z.string().trim().min(1).optional(),
    fullName: z.string().trim().min(1).optional(),
    designation: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    joiningDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updateTeacherStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const optionalTrimmedString = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().min(1).nullable().optional());

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return Number(trimmed);
  }
  return value;
}, z.number().int().min(0).nullable().optional());

export const updateTeacherProfileSchema = z
  .object({
    teacherId: teacherIdSchema.optional(),
    designation: optionalTrimmedString,
    qualification: optionalTrimmedString,
    totalExperience: optionalNonNegativeInt,
    academicExperience: optionalNonNegativeInt,
    industryExperience: optionalNonNegativeInt,
    researchInterest: optionalTrimmedString,
    nationalPublications: optionalNonNegativeInt,
    internationalPublications: optionalNonNegativeInt,
    bookChapters: optionalNonNegativeInt,
    projects: optionalNonNegativeInt,
  })
  .refine((data) => Object.keys(data).some((key) => key !== "teacherId"), {
    message: "At least one field is required",
  });

export const teacherProfileQuerySchema = z.object({
  teacherId: teacherIdSchema.optional(),
});

export const teacherIdCardDetailsSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    employeeId: z.string().trim().min(1).optional(),
    designation: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    joiningDate: z.coerce.date().optional(),
    phone: z.string().trim().min(5).optional(),
    email: z.string().trim().email().optional(),
    address: z.string().trim().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type UpdateTeacherStatusInput = z.infer<typeof updateTeacherStatusSchema>;
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
export type TeacherProfileQueryInput = z.infer<typeof teacherProfileQuerySchema>;
