import type { NextFunction, Response } from "express";

import { success } from "@/utils/apiResponse";
import type { AuthRequest } from "@/middleware/auth.middleware";
import { getTeacherSubstitutionsToday, listSubstitutionsAdmin } from "@/modules/substitution/service";
import { parsePagination, buildPaginationMeta } from "@/utils/pagination";

function getSchoolId(req: AuthRequest): string {
  if (!req.schoolId) {
    throw new Error("School ID not found");
  }
  return req.schoolId;
}

export async function teacherSubstitutionsToday(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const data = await getTeacherSubstitutionsToday(schoolId, userId);
    return success(res, data, "Today's substitutions fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminSubstitutions(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total, availability, approvedLeaves } = await listSubstitutionsAdmin({
      schoolId,
      date: typeof req.query?.date === "string" ? req.query.date : null,
      teacherId: typeof req.query?.teacherId === "string" ? req.query.teacherId : null,
      classId: typeof req.query?.classId === "string" ? req.query.classId : null,
      academicYearId:
        typeof req.query?.academicYearId === "string" ? req.query.academicYearId : null,
      includeAvailability:
        req.query?.includeAvailability === "true" || req.query?.includeAvailability === "1",
      pagination,
    });

    return success(
      res,
      { items, availability, approvedLeaves },
      "Substitutions fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}
