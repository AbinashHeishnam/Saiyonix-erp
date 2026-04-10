import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const studentIdSchema = z.string().uuid();
export const studentIdParamSchema = z.object({ id: studentIdSchema }).strict();
export const listStudentQuerySchema = paginationQuerySchema.extend({
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

export const rollAssignSchema = z
  .object({
    academicYearId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
  })
  .refine((data) => data.sectionId || data.classId, {
    message: "sectionId or classId is required",
    path: ["sectionId"],
  })
  .strict();

const studentStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "EXPELLED",
  "GRADUATED",
]);

const jsonValueSchema = z.unknown().refine(
  (value) => {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "medicalInfo must be valid JSON" }
);

const studentProfileSchema = z.object({
  profilePhotoUrl: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  emergencyContactName: z.string().trim().min(1).optional(),
  emergencyContactMobile: z.string().trim().min(5).optional(),
  previousSchool: z.string().trim().min(1).optional(),
  medicalInfo: jsonValueSchema.optional(),
});

const parentSchema = z.object({
  fullName: z.string().trim().min(1),
  mobile: z.string().trim().min(5),
  email: z.string().trim().email().optional(),
  relationToStudent: z.string().trim().min(1).optional(),
  isPrimary: z.boolean().optional(),
});

const enrollmentSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  rollNumber: z.number().int().positive().optional(),
  isDetained: z.boolean().optional(),
  promotionStatus: z.string().trim().min(1).optional(),
});

export const createStudentSchema = z
  .object({
    registrationNumber: z.string().trim().min(1),
    admissionNumber: z.string().trim().min(1).optional(),
    fullName: z.string().trim().min(1),
    dateOfBirth: z.coerce.date(),
    gender: z.string().trim().min(1),
    bloodGroup: z.string().trim().min(1).optional(),
    status: studentStatusSchema.optional(),
    profile: studentProfileSchema.optional(),
    parentId: z.string().uuid().optional(),
    parent: parentSchema.optional(),
    enrollment: enrollmentSchema,
  })
  .refine((data) => data.parentId || data.parent, {
    message: "Parent information is required",
    path: ["parentId"],
  });

export const updateStudentSchema = z
  .object({
    registrationNumber: z.string().trim().min(1).optional(),
    admissionNumber: z.string().trim().min(1).optional(),
    fullName: z.string().trim().min(1).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.string().trim().min(1).optional(),
    bloodGroup: z.string().trim().min(1).optional(),
    status: studentStatusSchema.optional(),
    profile: studentProfileSchema.partial().optional(),
    parentId: z.string().uuid().optional(),
    parent: parentSchema.optional(),
    enrollment: enrollmentSchema.partial().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const studentIdCardUpdateSchema = z.object({
  fullName: z.string().trim().min(1),
});

export const studentIdCardDetailsSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    admissionNumber: z.string().trim().min(1).optional(),
    dateOfBirth: z.coerce.date().optional(),
    bloodGroup: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    parentName: z.string().trim().min(1).optional(),
    parentPhone: z.string().trim().min(5).optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    rollNumber: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type ParentInput = z.infer<typeof parentSchema>;
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
