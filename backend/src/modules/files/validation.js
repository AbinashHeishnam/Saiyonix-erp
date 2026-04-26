import { z } from "zod";
export const secureFileQuerySchema = z
    .object({
    url: z.string().min(1).optional(),
    fileUrl: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
})
    .refine((data) => Boolean(data.url || data.fileUrl), {
    message: "url or fileUrl is required",
})
    .passthrough();
