import { z } from "zod";

export const studentAttendanceIdSchema = z.string().uuid();

export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY"]);

const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  remarks: z.string().trim().min(1).optional(),
});

export const createStudentAttendanceSchema = z.object({
  sectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  timetableSlotId: z.string().uuid(),
  attendanceDate: z.string().optional(),
  markedByTeacherId: z.string().uuid().optional(),
  records: z.array(attendanceRecordSchema).min(1),
});

export const updateStudentAttendanceSchema = z
  .object({
    status: attendanceStatusSchema.optional(),
    remarks: z.string().trim().min(1).nullable().optional(),
    correctionReason: z.string().trim().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine((data) => !data.status || Boolean(data.correctionReason), {
    message: "correctionReason is required when updating status",
    path: ["correctionReason"],
  });

export type CreateStudentAttendanceInput = z.infer<
  typeof createStudentAttendanceSchema
>;
export type UpdateStudentAttendanceInput = z.infer<
  typeof updateStudentAttendanceSchema
>;
