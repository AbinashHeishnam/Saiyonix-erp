import { Router } from "express";

import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../../middleware/auth.middleware";
import { authMiddleware } from "../../../middleware/auth.middleware";
import { requirePermission } from "../../../middleware/permission.middleware";
import { allowRoles } from "../../../middleware/rbac.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  approveAttendanceCorrection,
  rejectAttendanceCorrection,
  requestAttendanceCorrection,
} from "@/modules/attendance/corrections/service";
import {
  attendanceCorrectionIdSchema,
  attendanceCorrectionIdParamSchema,
  createCorrectionRequestSchema,
  reviewCorrectionSchema,
} from "@/modules/attendance/corrections/validation";

const correctionsRouter = Router();

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getActor(req: AuthRequest) {
  return {
    userId: req.user?.sub,
    roleType: req.user?.roleType,
  };
}

function parseId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = attendanceCorrectionIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

correctionsRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("attendance:update"),
  validate(createCorrectionRequestSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schoolId = getSchoolId(req);
      const data = await requestAttendanceCorrection(schoolId, req.body, getActor(req));
      return success(res, data, "Attendance correction requested", 201);
    } catch (error) {
      return next(error);
    }
  }
);

correctionsRouter.post(
  "/:id/approve",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:update"),
  validate({ params: attendanceCorrectionIdParamSchema, body: reviewCorrectionSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schoolId = getSchoolId(req);
      const id = parseId(req.params.id);
      const data = await approveAttendanceCorrection(
        schoolId,
        id,
        getActor(req),
        req.body
      );
      return success(res, data, "Attendance correction approved");
    } catch (error) {
      return next(error);
    }
  }
);

correctionsRouter.post(
  "/:id/reject",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:update"),
  validate({ params: attendanceCorrectionIdParamSchema, body: reviewCorrectionSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schoolId = getSchoolId(req);
      const id = parseId(req.params.id);
      const data = await rejectAttendanceCorrection(
        schoolId,
        id,
        getActor(req),
        req.body
      );
      return success(res, data, "Attendance correction rejected");
    } catch (error) {
      return next(error);
    }
  }
);

export default correctionsRouter;
