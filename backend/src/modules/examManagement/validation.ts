import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ id: examIdSchema }).strict();

export const createExamAdminSchema = z
  .object({
    academicYearId: z.string().uuid(),
    name: z.string().trim().min(1),
    type: z.enum(["PERIODIC", "TERM", "FINAL"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  })
  .strict();

export const addExamScheduleSchema = z
  .object({
    examId: z.string().uuid(),
    classId: z.string().uuid(),
    schedules: z
      .array(
        z
          .object({
            subjectId: z.string().uuid(),
            examDate: z.coerce.date(),
            startTime: z.string().regex(timeRegex, "Invalid time format"),
            endTime: z.string().regex(timeRegex, "Invalid time format"),
            shift: z.enum(["MORNING", "AFTERNOON"]),
          })
          .refine((data) => data.startTime < data.endTime, {
            message: "startTime must be before endTime",
            path: ["startTime"],
          })
      )
      .min(1),
  })
  .strict();

export const deleteExamScheduleSchema = z
  .object({
    examId: z.string().uuid(),
    classId: z.string().uuid(),
  })
  .strict();

export const setFinalExamSchema = z
  .object({
    isFinalExam: z.boolean(),
  })
  .strict();

export const addRoomAllocationSchema = z
  .object({
    examId: z.string().uuid(),
    allocations: z
      .array(
        z
          .object({
            classId: z.string().uuid(),
            sectionId: z.string().uuid(),
            roomNumber: z.string().trim().min(1),
            rollFrom: z.coerce.number().int().min(1),
            rollTo: z.coerce.number().int().min(1),
          })
          .refine((data) => data.rollTo >= data.rollFrom, {
            message: "rollTo must be greater than or equal to rollFrom",
            path: ["rollTo"],
          })
      )
      .min(1),
  })
  .strict();

export type CreateExamAdminInput = z.infer<typeof createExamAdminSchema>;
export type AddExamScheduleInput = z.infer<typeof addExamScheduleSchema>;
export type DeleteExamScheduleInput = z.infer<typeof deleteExamScheduleSchema>;
export type SetFinalExamInput = z.infer<typeof setFinalExamSchema>;
export type AddRoomAllocationInput = z.infer<typeof addRoomAllocationSchema>;
