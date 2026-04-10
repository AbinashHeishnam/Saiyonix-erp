import { z } from "zod";

export const uploadBodySchema = z.object({
  userType: z.enum(["student", "teacher", "parent", "common"]),
  userId: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1),
}).strict();

export const deleteFileSchema = z.object({
  fileUrl: z.string().trim().min(1),
}).strict();
