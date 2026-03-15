import { z } from "zod";

export const bulkImportQuerySchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(500).optional(),
});

export const studentBulkImportRowSchema = z.object({
  fullName: z.string().trim().min(1),
  dateOfBirth: z.string().trim().min(1),
  gender: z.string().trim().min(1),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  parentName: z.string().trim().min(1),
  parentMobile: z.string().trim().min(5),
  parentEmail: z.string().trim().email().optional(),
  relationToStudent: z.string().trim().min(1).optional(),
  bloodGroup: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  registrationNumber: z.string().trim().min(1).optional(),
  admissionNumber: z.string().trim().min(1).optional(),
  rollNumber: z.string().trim().min(1).optional(),
  photoPath: z.string().trim().min(1).optional(),
});

export type StudentBulkImportRowInput = z.infer<typeof studentBulkImportRowSchema>;
export type BulkImportQueryInput = z.infer<typeof bulkImportQuerySchema>;
