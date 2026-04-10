import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const notificationIdSchema = z.string().uuid();
export const notificationIdParamSchema = z.object({ id: notificationIdSchema }).strict();
export const listNotificationQuerySchema = paginationQuerySchema;
