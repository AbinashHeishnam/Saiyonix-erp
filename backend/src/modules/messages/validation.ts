import { z } from "zod";

export const sendMessageSchema = z.object({
  receiverId: z.string().uuid(),
  message: z.string().trim().min(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
