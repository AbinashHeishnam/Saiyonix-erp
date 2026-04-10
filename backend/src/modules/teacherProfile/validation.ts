import { z } from "zod";

export const teacherProfileTeacherIdSchema = z.string().uuid();
export const teacherProfileTeacherIdParamSchema = z
  .object({ teacherId: teacherProfileTeacherIdSchema })
  .strict();

export const createTeacherProfileSchema = z.object({
  teacherId: z.string().uuid(),
  qualification: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  photoUrl: z.string().trim().min(1).optional(),
  emergencyContactMobile: z.string().trim().min(5).optional(),
});

export const updateTeacherProfileSchema = z
  .object({
    qualification: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    photoUrl: z.string().trim().min(1).optional(),
    emergencyContactMobile: z.string().trim().min(5).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateTeacherProfileInput = z.infer<typeof createTeacherProfileSchema>;
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
