import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import {
  addAssignmentAttachment as addAssignmentAttachmentService,
  createAssignment as createAssignmentService,
  deleteAssignment as deleteAssignmentService,
  getAssignmentById as getAssignmentByIdService,
  getSubmissionStatus as getSubmissionStatusService,
  getSubmissionsForAssignment as getSubmissionsForAssignmentService,
  gradeSubmission as gradeSubmissionService,
  listAssignments as listAssignmentsService,
  submitAssignment as submitAssignmentService,
  updateAssignment as updateAssignmentService,
} from "@/modules/assignments/service";
import {
  assignmentIdSchema,
  listAssignmentQuerySchema,
  submissionIdSchema,
} from "@/modules/assignments/validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function parseId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = assignmentIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseSubmissionId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = submissionIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseQuery(query: AuthRequest["query"]) {
  const parsed = listAssignmentQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid query parameters", {
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
}

function getActor(req: AuthRequest) {
  if (!req.user?.sub || !req.user?.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: req.user.sub, roleType: req.user.roleType };
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await createAssignmentService(schoolId, req.body, actor);
    return success(res, data, "Assignment created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const pagination = parsePagination(req.query);
    const cappedLimit = Math.min(pagination.limit, 50);
    const safePagination = {
      ...pagination,
      limit: cappedLimit,
      take: cappedLimit,
      skip: (pagination.page - 1) * cappedLimit,
    };
    const filters = parseQuery(req.query);

    const { items, total } = await listAssignmentsService(
      schoolId,
      filters,
      actor,
      safePagination
    );

    return success(
      res,
      items,
      "Assignments fetched successfully",
      200,
      buildPaginationMetaWithSync(total, safePagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await getAssignmentByIdService(schoolId, id, actor);
    return success(res, data, "Assignment fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await updateAssignmentService(schoolId, id, req.body, actor);
    return success(res, data, "Assignment updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function addAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const assignmentId = parseId(req.params.id);

    const uploadedFile = (req as AuthRequest & {
      uploadedFile?: { fileUrl: string; fileKey: string };
      file?: { originalname?: string };
    }).uploadedFile;

    if (!uploadedFile) {
      throw new ApiError(400, "Attachment file is required");
    }

    const fileName =
      (req as AuthRequest & { file?: { originalname?: string } }).file?.originalname ??
      "attachment";

    const data = await addAssignmentAttachmentService(
      schoolId,
      assignmentId,
      {
        fileName,
        fileUrl: uploadedFile.fileUrl,
        fileKey: uploadedFile.fileKey,
      },
      actor
    );

    return success(res, data, "Attachment added successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await deleteAssignmentService(schoolId, id, actor);
    return success(res, data, "Assignment deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function submit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await submitAssignmentService(schoolId, id, req.body, actor);
    return success(res, data, "Assignment submitted successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listSubmissions(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const pagination = parsePagination(req.query);
    const cappedLimit = Math.min(pagination.limit, 50);
    const safePagination = {
      ...pagination,
      limit: cappedLimit,
      take: cappedLimit,
      skip: (pagination.page - 1) * cappedLimit,
    };
    const id = parseId(req.params.id);
    const { items, total } = await getSubmissionsForAssignmentService(
      schoolId,
      id,
      actor,
      safePagination
    );
    return success(
      res,
      items,
      "Submissions fetched successfully",
      200,
      buildPaginationMetaWithSync(total, safePagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function grade(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseSubmissionId(req.params.id);
    const data = await gradeSubmissionService(schoolId, id, req.body, actor);
    return success(res, data, "Submission graded successfully");
  } catch (error) {
    return next(error);
  }
}

export async function submissionStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const assignmentId = parseId(req.params.id);
    const data = await getSubmissionStatusService(schoolId, assignmentId, actor);
    return success(res, data, "Submission status fetched successfully");
  } catch (error) {
    return next(error);
  }
}
