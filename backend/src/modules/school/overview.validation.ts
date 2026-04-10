import { z } from "zod";

export const updateSchoolOverviewSchema = z.object({
  schoolName: z.string().trim().min(1, "schoolName is required"),
  schoolAddress: z.string().trim().min(1, "schoolAddress is required"),
  schoolPhone: z.string().trim().min(1, "schoolPhone is required"),
  officialEmail: z.string().trim().email("Invalid email"),
  logoUrl: z.string().trim().min(1).nullable().optional(),
});

export type UpdateSchoolOverviewInput = z.infer<typeof updateSchoolOverviewSchema>;
