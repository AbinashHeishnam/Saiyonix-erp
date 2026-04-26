import { z } from "zod";
export const createMarkSchema = z
    .object({
    examSubjectId: z.string().uuid(),
    studentId: z.string().uuid(),
    marksObtained: z.coerce.number().min(0),
    remarks: z.string().trim().min(1).optional(),
})
    .strict();
export const markIdSchema = z.string().uuid();
export const markIdParamSchema = z.object({ id: markIdSchema }).strict();
export const updateMarkSchema = z
    .object({
    marksObtained: z.coerce.number().min(0),
})
    .strict();
export const bulkCreateMarksSchema = z
    .object({
    examSubjectId: z.string().uuid(),
    items: z
        .array(z
        .object({
        studentId: z.string().uuid(),
        marksObtained: z.coerce.number().min(0),
    })
        .strict())
        .min(1)
        .max(100),
})
    .strict()
    .refine((data) => {
    const ids = data.items.map((item) => item.studentId);
    return new Set(ids).size === ids.length;
}, {
    message: "Duplicate studentId in payload",
    path: ["items"],
});
