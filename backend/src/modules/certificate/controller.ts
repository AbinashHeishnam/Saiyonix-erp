import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  approveCertificateRequest,
  generateTcCertificate,
  listAdminCertificateRequests,
  listCertificateRequestsForActor,
  rejectCertificateRequest,
  requestCertificate,
} from "@/modules/certificate/service";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.schoolId;
}

function getActor(req: AuthRequest) {
  const userId = req.user?.sub;
  const roleType = req.user?.roleType;
  if (!userId || !roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  return { userId, roleType };
}

export async function createCertificateRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await requestCertificate(schoolId, actor, req.body);
    return success(res, data, "Certificate request created", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listCertificateRequests(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const studentId =
      typeof req.query?.studentId === "string" ? req.query.studentId : null;
    const data = await listCertificateRequestsForActor(schoolId, actor, studentId);
    return success(res, data, "Certificates fetched");
  } catch (error) {
    return next(error);
  }
}

export async function listCertificateRequestsForAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const data = await listAdminCertificateRequests(schoolId);
    return success(res, data, "Certificate requests fetched");
  } catch (error) {
    return next(error);
  }
}

export async function approveCertificate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const requestId = req.body?.requestId as string | undefined;
    if (!requestId) {
      throw new ApiError(400, "requestId is required");
    }
    const data = await approveCertificateRequest(schoolId, actor, requestId);
    return success(res, data, "Certificate approved");
  } catch (error) {
    return next(error);
  }
}

export async function rejectCertificate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const requestId = req.body?.requestId as string | undefined;
    const rejectedReason = req.body?.rejectedReason as string | undefined;
    if (!requestId || !rejectedReason) {
      throw new ApiError(400, "requestId and rejectedReason are required");
    }
    const data = await rejectCertificateRequest(schoolId, actor, requestId, rejectedReason);
    return success(res, data, "Certificate rejected");
  } catch (error) {
    return next(error);
  }
}

export async function generateTc(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await generateTcCertificate(schoolId, actor, req.body);
    return success(res, data, "TC generated", 201);
  } catch (error) {
    return next(error);
  }
}
