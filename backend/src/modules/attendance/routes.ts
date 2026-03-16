import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { attendanceLimiter } from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  create,
  listAudit,
  schoolSummary,
  studentMonthlySummary,
  update,
} from "./controller";
import correctionsRouter from "./corrections/routes";
import { createAttendanceSchema, updateAttendanceSchema } from "./validation";

const attendanceRouter = Router();

attendanceRouter.use(attendanceLimiter);

attendanceRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("attendance:mark"),
  validate(createAttendanceSchema),
  create
);

attendanceRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("attendance:update"),
  validate(updateAttendanceSchema),
  update
);

attendanceRouter.get(
  "/audit",
  authMiddleware,
  requirePermission("attendance:read"),
  listAudit
);

attendanceRouter.get(
  "/summaries/student",
  authMiddleware,
  requirePermission("attendance:read"),
  studentMonthlySummary
);

attendanceRouter.get(
  "/summaries/school",
  authMiddleware,
  requirePermission("attendance:read"),
  schoolSummary
);

attendanceRouter.use("/corrections", correctionsRouter);

export default attendanceRouter;
