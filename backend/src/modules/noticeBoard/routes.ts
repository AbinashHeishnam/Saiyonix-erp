import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, getMeById, list, listMe, remove, update } from "@/modules/noticeBoard/controller";
import {
  createNoticeSchema,
  listNoticeQuerySchema,
  listNoticeMeQuerySchema,
  noticeIdParamSchema,
  updateNoticeSchema,
} from "@/modules/noticeBoard/validation";

const noticeRouter = Router();

noticeRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notice:create"),
  validate(createNoticeSchema),
  create
);

noticeRouter.get(
  "/me",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("notice:read"),
  validate({ query: listNoticeMeQuerySchema }),
  listMe
);

noticeRouter.get(
  "/me/:id",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("notice:read"),
  validate({ params: noticeIdParamSchema }),
  getMeById
);

noticeRouter.get(
  "/",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notice:read"),
  validate({ query: listNoticeQuerySchema }),
  list
);

noticeRouter.get(
  "/:id",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notice:read"),
  validate({ params: noticeIdParamSchema }),
  getById
);

noticeRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notice:update"),
  validate({ params: noticeIdParamSchema, body: updateNoticeSchema }),
  update
);

noticeRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notice:delete"),
  validate({ params: noticeIdParamSchema }),
  remove
);

export default noticeRouter;
