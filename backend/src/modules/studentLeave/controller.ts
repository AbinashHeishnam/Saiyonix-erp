import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "../../utils/pagination";
import {
  approveStudentLeave as approveStudentLeaveService,
  cancelStudentLeave as cancelStudentLeaveService,
  createStudentLeave as createStudentLeaveService,
  getStudentLeaveById as getStudentLeaveByIdService,
  getStudentLeaveTimeline as getStudentLeaveTimelineService,
  listStudentLeaves as listStudentLeavesService,
  rejectStudentLeave as rejectStudentLeaveService,
} from "./service";
import { studentLeaveIdSchema } from "./validation";

function getSchoolId(req: AuthRequest): string {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getActor(req: AuthRequest): { userId: string; roleType: string } {
  const userId = req.user?.sub;
  const roleType = req.user?.roleType;

  if (!userId || !roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId, roleType };
}

function parseId(id: unknown): string {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = studentLeaveIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await createStudentLeaveService(schoolId, req.body, actor);
    return success(res, data, "Leave request created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listStudentLeavesService(
      schoolId,
      actor,
      pagination
    );

    return success(
      res,
      items,
      "Leave requests fetched successfully",
      200,
      buildPaginationMetaWithSync(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await getStudentLeaveByIdService(schoolId, id, actor);
    return success(res, data, "Leave request fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function approve(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await approveStudentLeaveService(schoolId, id, actor);
    return success(res, data, "Leave request approved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function reject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await rejectStudentLeaveService(schoolId, id, actor);
    return success(res, data, "Leave request rejected successfully");
  } catch (error) {
    return next(error);
  }
}

export async function cancel(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await cancelStudentLeaveService(schoolId, id, actor);
    return success(res, data, "Leave request cancelled successfully");
  } catch (error) {
    return next(error);
  }
}

export async function timeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await getStudentLeaveTimelineService(schoolId, id, actor);
    return success(res, data, "Leave timeline fetched successfully");
  } catch (error) {
    return next(error);
  }
}
