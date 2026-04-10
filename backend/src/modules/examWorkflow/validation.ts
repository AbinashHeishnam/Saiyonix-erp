import { z } from "zod";

export const examIdSchema = z.string().uuid();
export const classIdSchema = z.string().uuid();
export const sectionIdSchema = z.string().uuid();
export const subjectIdSchema = z.string().uuid();

export const marksEntryQuerySchema = z.object({
  examId: examIdSchema,
  classId: classIdSchema,
  sectionId: sectionIdSchema,
  subjectId: subjectIdSchema,
});

export const marksEntryAllQuerySchema = z.object({
  examId: examIdSchema,
  classId: classIdSchema,
  sectionId: sectionIdSchema,
});

export const submitMarksSchema = z.object({
  examId: examIdSchema,
  classId: classIdSchema,
  sectionId: sectionIdSchema,
  subjectId: subjectIdSchema,
  totalMarks: z.number().positive(),
  passMarks: z.number().min(0),
  items: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        marksObtained: z.number().min(0),
        isAbsent: z.boolean().optional(),
      })
    )
    .min(1),
});

export const submitMarksBulkSchema = z.object({
  examId: examIdSchema,
  classId: classIdSchema,
  sectionId: sectionIdSchema,
  subjects: z.array(
    z.object({
      subjectId: subjectIdSchema,
      totalMarks: z.number().positive(),
      passMarks: z.number().min(0),
      items: z
        .array(
          z.object({
            studentId: z.string().uuid(),
            marksObtained: z.number().min(0),
            isAbsent: z.boolean().optional(),
          })
        )
        .min(1),
    })
  ).min(1),
});

export const recheckSchema = z.object({
  examId: examIdSchema,
  subjectId: subjectIdSchema,
  reason: z.string().trim().min(1),
  studentId: z.string().uuid().optional(),
});

export const examIdParamSchema = z.object({ examId: examIdSchema }).strict();
export const complaintQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
});

export const teacherAnalyticsQuerySchema = z.object({
  examId: examIdSchema,
  sectionId: sectionIdSchema,
  marksThreshold: z.coerce.number().min(0).max(100).optional(),
  attendanceThreshold: z.coerce.number().min(0).max(100).optional(),
});

export const teacherMyClassAnalyticsQuerySchema = z.object({
  examId: examIdSchema,
  teacherId: z.string().uuid().optional(),
  marksThreshold: z.coerce.number().min(0).max(100).optional(),
  attendanceThreshold: z.coerce.number().min(0).max(100).optional(),
});
