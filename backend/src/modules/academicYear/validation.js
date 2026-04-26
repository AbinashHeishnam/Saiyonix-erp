import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const academicYearIdSchema = z.string().uuid();
export const academicYearIdParamSchema = z.object({ id: academicYearIdSchema }).strict();
export const listAcademicYearQuerySchema = paginationQuerySchema;
export const createAcademicYearSchema = z
    .object({
    label: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isActive: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    cloneFromAcademicYearId: z.string().uuid().optional(),
    cloneFromPrevious: z.boolean().optional(),
})
    .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["startDate"],
})
    .refine((data) => !(data.cloneFromAcademicYearId && data.cloneFromPrevious), {
    message: "Provide either cloneFromAcademicYearId or cloneFromPrevious, not both",
    path: ["cloneFromAcademicYearId"],
});
export const updateAcademicYearSchema = z
    .object({
    label: z.string().trim().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
    isLocked: z.boolean().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
})
    .refine((data) => {
    if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
    }
    return true;
}, {
    message: "startDate must be before or equal to endDate",
    path: ["startDate"],
});
export const switchAcademicYearSchema = z
    .object({
    fromAcademicYearId: z.string().uuid().optional(),
    toAcademicYearId: z.string().uuid(),
    resetOperationalData: z.boolean().optional(),
})
    .strict();
