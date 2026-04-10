import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  applyFinalPromotion,
  generatePromotionList,
  listPromotionTransitions,
  getPromotionCriteria,
  getParentPromotionStatus,
  getRollNumberAssignmentStatus,
  getStudentPromotionStatus,
  previewPromotionEligibility,
  listPromotionRecords,
  overridePromotion,
  reviewPromotionOverride,
  publishPromotion,
  assignRollNumbers,
  upsertPromotionCriteria,
} from "@/modules/promotion/service";
import {
  applyFinalPromotionSchema,
  assignRollNumbersSchema,
  generatePromotionSchema,
  listPromotionSchema,
  overridePromotionSchema,
  reviewPromotionOverrideSchema,
  promotionCriteriaSchema,
  previewPromotionSchema,
  promotionTransitionSchema,
  publishPromotionSchema,
} from "@/modules/promotion/validation";

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

export async function upsertCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = promotionCriteriaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid criteria payload");
    }
    const data = await upsertPromotionCriteria(schoolId, parsed.data, req.user?.sub);
    return success(res, data, "Promotion criteria saved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = String(req.query.academicYearId ?? "");
    if (!academicYearId) {
      throw new ApiError(400, "academicYearId is required");
    }
    const data = await getPromotionCriteria(schoolId, academicYearId);
    return success(res, data, "Promotion criteria fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = generatePromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await generatePromotionList(schoolId, parsed.data);
    return success(res, data, "Promotion list generated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function preview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = previewPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await previewPromotionEligibility(schoolId, parsed.data);
    return success(res, data, "Promotion eligibility preview generated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = listPromotionSchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid query");
    }
    const data = await listPromotionRecords(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion list fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function override(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = overridePromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await overridePromotion(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion override saved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function reviewOverride(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = reviewPromotionOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await reviewPromotionOverride(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion override reviewed successfully");
  } catch (error) {
    return next(error);
  }
}

export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = publishPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await publishPromotion(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion published successfully");
  } catch (error) {
    return next(error);
  }
}

export async function applyFinal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = applyFinalPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await applyFinalPromotion(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion applied successfully");
  } catch (error) {
    return next(error);
  }
}

export async function transitions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = promotionTransitionSchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid query");
    }
    const data = await listPromotionTransitions(schoolId, getActor(req), parsed.data);
    return success(res, data, "Promotion transitions fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function rollNumberStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = String(req.query.academicYearId ?? "");
    if (!academicYearId) {
      throw new ApiError(400, "academicYearId is required");
    }
    const data = await getRollNumberAssignmentStatus(schoolId, getActor(req), academicYearId);
    return success(res, data, "Roll number status fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function assignRollNumbersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = assignRollNumbersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await assignRollNumbers(schoolId, getActor(req), parsed.data.academicYearId);
    return success(res, data, "Roll numbers assigned successfully");
  } catch (error) {
    return next(error);
  }
}

export async function studentStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getStudentPromotionStatus(schoolId, getActor(req));
    return success(res, data, "Promotion status fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function parentStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getParentPromotionStatus(schoolId, getActor(req));
    return success(res, data, "Promotion status fetched successfully");
  } catch (error) {
    return next(error);
  }
}
