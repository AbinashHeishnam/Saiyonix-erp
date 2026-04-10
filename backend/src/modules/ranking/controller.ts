import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import { getClassRanking, getRankingForActor, listRankingsForAdmin, recomputeRanking } from "@/modules/ranking/service";
import { classRankingParamSchema, examIdSchema } from "@/modules/ranking/validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getActor(req: AuthRequest) {
  if (!req.user?.sub || !req.user?.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: req.user.sub, roleType: req.user.roleType };
}

function parseExamId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = examIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

export async function recompute(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const examId = parseExamId(req.params.examId);
    if (
      actor.roleType !== "SUPER_ADMIN" &&
      actor.roleType !== "ADMIN" &&
      actor.roleType !== "ACADEMIC_SUB_ADMIN"
    ) {
      throw new ApiError(403, "Forbidden");
    }
    await recomputeRanking(schoolId, examId, {
      userId: actor.userId,
      roleType: actor.roleType as "SUPER_ADMIN" | "ADMIN" | "ACADEMIC_SUB_ADMIN",
    });
    return success(res, { status: "DONE" }, "Ranking recomputed");
  } catch (error) {
    return next(error);
  }
}

export async function get(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const examId = parseExamId(req.params.examId);

    if (actor.roleType === "ADMIN" || actor.roleType === "ACADEMIC_SUB_ADMIN" || actor.roleType === "SUPER_ADMIN") {
      const pagination = parsePagination(req.query);
      const cappedLimit = Math.min(pagination.limit, 50);
      const safePagination = {
        ...pagination,
        limit: cappedLimit,
        take: cappedLimit,
        skip: (pagination.page - 1) * cappedLimit,
      };

      const { items, total } = await listRankingsForAdmin(
        schoolId,
        examId,
        safePagination
      );

      return success(
        res,
        items,
        "Ranking fetched successfully",
        200,
        buildPaginationMetaWithSync(total, safePagination)
      );
    }

    const data = await getRankingForActor(schoolId, examId, actor);
    return success(res, data, "Ranking fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getClass(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    if (
      actor.roleType !== "SUPER_ADMIN" &&
      actor.roleType !== "ADMIN" &&
      actor.roleType !== "ACADEMIC_SUB_ADMIN"
    ) {
      throw new ApiError(403, "Forbidden");
    }

    const parsed = classRankingParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid params");
    }

    const data = await getClassRanking(schoolId, parsed.data.examId, parsed.data.classId);
    return success(res, data, "Class ranking fetched successfully");
  } catch (error) {
    return next(error);
  }
}
