import { z } from "zod";

export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ examId: examIdSchema }).strict();

export const admitCardQuerySchema = z
  .object({
    studentId: z.string().uuid().optional(),
  })
  .strict();

export const admitCardStudentParamSchema = z
  .object({
    studentId: z.string().uuid(),
  })
  .strict();

export const admitCardByStudentQuerySchema = z
  .object({
    examId: z.string().uuid(),
  })
  .strict();

export const unlockAdmitCardSchema = z
  .object({
    studentId: z.string().uuid(),
    reason: z.string().optional(),
  })
  .strict();

export const generateAdmitCardSchema = z
  .object({
    examId: z.string().uuid(),
  })
  .strict();

export const publishAdmitCardSchema = z
  .object({
    examId: z.string().uuid(),
  })
  .strict();

export const toggleAdmitCardSchema = z
  .object({
    examId: z.string().uuid(),
    isPublished: z.boolean(),
  })
  .strict();

export const admitCardControlQuerySchema = z
  .object({
    examId: z.string().uuid().optional(),
  })
  .strict();

export type AdmitCardControlQueryInput = z.infer<typeof admitCardControlQuerySchema>;

export type UnlockAdmitCardInput = z.infer<typeof unlockAdmitCardSchema>;
