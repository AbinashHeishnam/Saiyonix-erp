import { z } from "zod";

export const teacherIdSchema = z.string().uuid();

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

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type UpdateTeacherStatusInput = z.infer<typeof updateTeacherStatusSchema>;
