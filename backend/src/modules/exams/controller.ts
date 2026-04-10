import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import {
  addExamSubject as addExamSubjectService,
  addExamTimetable as addExamTimetableService,
  createExam as createExamService,
  getExamById as getExamByIdService,
  listExams as listExamsService,
  lockExamMarks as lockExamMarksService,
  lockExam as lockExamService,
  publishExamTimetable as publishExamTimetableService,
  unlockExamMarks as unlockExamMarksService,
  publishExam as publishExamService,
  registerForExam as registerForExamService,
  listExamRegistrations as listExamRegistrationsService,
  listExamRegistrationsAdmin as listExamRegistrationsAdminService,
} from "@/modules/exams/service";
import {
  examIdSchema,
  examRegistrationsQuerySchema,
  examRegistrationsAdminQuerySchema,
  listExamQuerySchema,
  registerExamSchema,
} from "@/modules/exams/validation";

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

  const parsed = examIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseQuery(query: AuthRequest["query"]) {
  const parsed = listExamQuerySchema.safeParse(query);

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
    const data = await createExamService(schoolId, req.body, actor);
    return success(res, data, "Exam created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function addSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await addExamSubjectService(schoolId, id, req.body, actor);
    return success(res, data, "Exam subject added successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function addTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await addExamTimetableService(schoolId, id, req.body, actor);
    return success(res, data, "Exam timetable added successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await getExamByIdService(schoolId, id, actor);
    return success(res, data, "Exam fetched successfully");
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

    const { items, total } = await listExamsService(
      schoolId,
      filters,
      actor,
      safePagination
    );

    return success(
      res,
      items,
      "Exams fetched successfully",
      200,
      buildPaginationMetaWithSync(total, safePagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await publishExamService(schoolId, id, actor);
    return success(res, data, "Exam published successfully");
  } catch (error) {
    return next(error);
  }
}

export async function lock(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await lockExamService(schoolId, id, actor);
    return success(res, data, "Exam locked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function lockMarks(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await lockExamMarksService(schoolId, id, actor);
    return success(res, data, "Marks locked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function unlockMarks(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await unlockExamMarksService(schoolId, id, actor);
    return success(res, data, "Marks unlocked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const parsed = registerExamSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await registerForExamService(
      schoolId,
      parsed.data.examId,
      actor,
      parsed.data.studentId ?? null
    );
    return success(res, data, "Exam registration successful", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listRegistrations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const parsed = examRegistrationsQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid query");
    }

    const data = await listExamRegistrationsService(
      schoolId,
      actor,
      parsed.data.studentId ?? null
    );

    return success(res, data, "Exam registrations fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function listRegistrationsAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const parsed = examRegistrationsAdminQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid query");
    }

    const data = await listExamRegistrationsAdminService(
      schoolId,
      actor,
      parsed.data.examId
    );
    return success(res, data, "Exam registrations fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function publishTimetable(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await publishExamTimetableService(schoolId, id, actor);
    return success(res, data, "Exam timetable published successfully");
  } catch (error) {
    return next(error);
  }
}
