import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import {
  createPaymentOrder,
  verifyPaymentSignature,
} from "./payment.service";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

export async function createOrder(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createPaymentOrder({
      ...req.body,
      metadata: {
        ...(req.body?.metadata ?? {}),
        schoolId,
      },
    });
    return success(res, data, "Payment order created", 201);
  } catch (error) {
    return next(error);
  }
}

export async function verify(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    getSchoolId(req);
    const isValid = verifyPaymentSignature(req.body);
    if (!isValid) {
      throw new ApiError(400, "Invalid payment signature");
    }
    return success(res, { verified: true }, "Payment verified");
  } catch (error) {
    return next(error);
  }
}
