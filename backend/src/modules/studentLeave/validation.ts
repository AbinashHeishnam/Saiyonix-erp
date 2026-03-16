import { z } from "zod";

export const studentLeaveIdSchema = z.string().uuid();

export const createStudentLeaveSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(500),
    leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"]).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export type CreateStudentLeaveInput = z.infer<typeof createStudentLeaveSchema>;
