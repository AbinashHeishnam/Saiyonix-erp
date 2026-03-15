import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const periodIdSchema = z.string().uuid();

export const createPeriodSchema = z
  .object({
    periodNumber: z.number().int().positive(),
    startTime: z.string().regex(timeRegex, "Invalid time format"),
    endTime: z.string().regex(timeRegex, "Invalid time format"),
    isLunch: z.boolean().optional(),
    isFirstPeriod: z.boolean().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "startTime must be before endTime",
    path: ["startTime"],
  });

export const updatePeriodSchema = z
  .object({
    periodNumber: z.number().int().positive().optional(),
    startTime: z.string().regex(timeRegex, "Invalid time format").optional(),
    endTime: z.string().regex(timeRegex, "Invalid time format").optional(),
    isLunch: z.boolean().optional(),
    isFirstPeriod: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }

      return true;
    },
    {
      message: "startTime must be before endTime",
      path: ["startTime"],
    }
  );

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;
