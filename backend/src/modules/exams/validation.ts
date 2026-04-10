import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ id: examIdSchema }).strict();
export const examSubjectIdSchema = z.string().uuid();

export const createExamSchema = z
  .object({
    academicYearId: z.string().uuid(),
    termNo: z.coerce.number().int().min(1),
    title: z.string().trim().min(1),
    isFinalExam: z.boolean().optional(),
  })
  .strict();

export const addExamSubjectSchema = z
  .object({
    classSubjectId: z.string().uuid(),
    maxMarks: z.coerce.number().min(0),
    passMarks: z.coerce.number().min(0),
  })
  .refine((data) => data.passMarks <= data.maxMarks, {
    message: "passMarks must be less than or equal to maxMarks",
    path: ["passMarks"],
  })
  .strict();

export const addExamTimetableSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            examSubjectId: z.string().uuid(),
            examDate: z.coerce.date(),
            startTime: z.string().regex(timeRegex, "Invalid time format"),
            endTime: z.string().regex(timeRegex, "Invalid time format"),
            venue: z.string().trim().min(1).nullable().optional(),
          })
          .refine((data) => data.startTime < data.endTime, {
            message: "startTime must be before endTime",
            path: ["startTime"],
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export const listExamQuerySchema = paginationQuerySchema
  .extend({
    academicYearId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
  })
  .strict();

export const registerExamSchema = z
  .object({
    examId: z.string().uuid(),
    studentId: z.string().uuid().optional(),
  })
  .strict();

export const examRegistrationsQuerySchema = z
  .object({
    studentId: z.string().uuid().optional(),
  })
  .passthrough();

export const examRegistrationsAdminQuerySchema = z
  .object({
    examId: z.string().uuid(),
  })
  .strict();

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type AddExamSubjectInput = z.infer<typeof addExamSubjectSchema>;
export type AddExamTimetableInput = z.infer<typeof addExamTimetableSchema>;
export type ListExamQueryInput = z.infer<typeof listExamQuerySchema>;
export type RegisterExamInput = z.infer<typeof registerExamSchema>;
export type ExamRegistrationsQueryInput = z.infer<typeof examRegistrationsQuerySchema>;
export type ExamRegistrationsAdminQueryInput = z.infer<typeof examRegistrationsAdminQuerySchema>;
