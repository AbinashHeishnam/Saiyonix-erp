import { z } from "zod";
export const studentBulkImportRowSchema = z.object({
    full_name: z.string().trim().min(1),
    registration_number: z.string().trim().min(1),
    admission_number: z.string().trim().min(1).optional(),
    date_of_birth: z.string().trim().min(1),
    gender: z.string().trim().min(1),
    blood_group: z.string().trim().min(1).optional(),
    parent_mobile: z.string().trim().min(1),
    parent_name: z.string().trim().min(1).optional(),
    class_name: z.string().trim().min(1),
    section_name: z.string().trim().min(1),
});
