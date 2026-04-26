import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const attendanceIdSchema = z.string().uuid();
export const attendanceIdParamSchema = z.object({ id: attendanceIdSchema }).strict();
export const attendanceStatusSchema = z.enum([
    "PRESENT",
    "ABSENT",
    "LATE",
    "HALF_DAY",
    "EXCUSED",
]);
const attendanceRecordSchema = z.object({
    studentId: z.string().uuid(),
    status: attendanceStatusSchema,
    remarks: z.string().trim().min(1).optional(),
});
export const createAttendanceSchema = z.object({
    sectionId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    attendanceDate: z.string().optional(),
    records: z.array(attendanceRecordSchema).min(1),
});
export const updateAttendanceSchema = z
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
export const attendanceAuditQuerySchema = paginationQuerySchema
    .extend({
    attendanceId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
})
    .strict();
export const studentMonthlySummaryQuerySchema = z
    .object({
    studentId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    month: z.string().min(1),
    year: z.string().min(1),
})
    .strict();
export const schoolSummaryQuerySchema = z
    .object({
    academicYearId: z.string().uuid(),
    date: z.string().optional(),
})
    .strict();
