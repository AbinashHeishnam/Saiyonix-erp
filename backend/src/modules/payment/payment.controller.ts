import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import prisma from "@/core/db/prisma";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { getRazorpayConfig } from "@/core/config/externalServices";
import {
  applyGatewayPaymentUpdate,
  createPaymentOrder,
  createPaymentLog,
  createManualPayment,
  findPaymentByGatewayOrderId,
  generateAdminReceiptPdf,
  listPayments,
  listPaymentLogs,
  verifyPaymentSignature,
} from "@/modules/payment/payment.service";
import { manualPaymentSchema } from "@/modules/payment/validation";

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

async function resolveStudentId(
  schoolId: string,
  actor: { userId: string; roleType: string },
  studentIdParam?: string | null
) {
  if (actor.roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    return student.id;
  }

  if (actor.roleType === "PARENT") {
    if (!studentIdParam) {
      throw new ApiError(400, "studentId is required for parent access");
    }
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        studentId: studentIdParam,
        parent: {
          is: { userId: actor.userId, schoolId },
        },
        student: { schoolId, deletedAt: null },
      },
      select: { studentId: true },
    });
    if (!link) {
      throw new ApiError(403, "Parent is not linked to this student");
    }
    return link.studentId;
  }

  if (!studentIdParam) {
    return null;
  }

  return studentIdParam;
}

export async function createOrder(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const resolvedStudentId = await resolveStudentId(
      schoolId,
      actor,
      req.body?.studentId ?? null
    );

    const data = await createPaymentOrder(
      {
        ...req.body,
        ...(resolvedStudentId ? { studentId: resolvedStudentId } : {}),
        metadata: {
          ...(req.body?.metadata ?? {}),
          schoolId,
        },
      },
      schoolId
    );
    return success(res, data, "Payment order created", 201);
  } catch (error) {
    return next(error);
  }
}

export async function getRazorpayKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const config = await getRazorpayConfig();
    return success(
      res,
      { keyId: config.keyId ?? null },
      "Razorpay key fetched"
    );
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
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    let isValid = false;
    let errorMessage: string | null = null;

    try {
      console.log("[VERIFY] order:", req.body?.razorpayOrderId);
      console.log("[VERIFY] payment:", req.body?.razorpayPaymentId);
      isValid = await verifyPaymentSignature(req.body);
      console.log("[VERIFY] valid:", isValid);
      if (!isValid) {
        errorMessage = req.body?.errorMessage ?? "Invalid payment signature";
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Payment verification failed";
    }

    if (!isValid) {
      const payment = await findPaymentByGatewayOrderId(req.body.razorpayOrderId);
      if (payment) {
        await createPaymentLog({
          paymentId: payment.id,
          studentId: payment.student.id,
          studentName: payment.student.fullName ?? "Student",
          rollNumber: payment.student.registrationNumber ?? "—",
          amount: Number(payment.amount),
          transactionId: req.body.razorpayPaymentId ?? null,
          status: "FAILED",
          method: "RAZORPAY",
          source: "VERIFY",
          errorMessage: errorMessage ?? "Payment verification failed",
          rawPayload: req.body,
        });
      }
      throw new ApiError(400, errorMessage ?? "Invalid payment signature");
    }

    const payment = await findPaymentByGatewayOrderId(req.body.razorpayOrderId);
    if (!payment || payment.student.schoolId !== schoolId) {
      throw new ApiError(404, "Payment order not found");
    }

    if (actor.roleType === "STUDENT") {
      if (!payment.student.userId || payment.student.userId !== actor.userId) {
        throw new ApiError(403, "Student account not linked");
      }
    }

    if (actor.roleType === "PARENT") {
      const link = await prisma.parentStudentLink.findFirst({
        where: {
          studentId: payment.student.id,
          parent: { is: { userId: actor.userId, schoolId } },
          student: { schoolId, deletedAt: null },
        },
        select: { studentId: true },
      });
      if (!link) {
        throw new ApiError(403, "Parent is not linked to this student");
      }
    }

    const result = await applyGatewayPaymentUpdate({
      gatewayOrderId: req.body.razorpayOrderId,
      gatewayPaymentId: req.body.razorpayPaymentId,
      gatewaySignature: req.body.razorpaySignature,
      status: "PAID",
      source: "VERIFY",
      rawPayload: req.body,
    });

    if (result.action === "NOT_FOUND") {
      throw new ApiError(404, "Payment order not found");
    }

    return success(
      res,
      { verified: true, paymentStatus: result.payment.status },
      "Payment verified"
    );
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listPayments(schoolId, pagination);
    return success(
      res,
      items,
      "Payments fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function listLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const dateFromValue = typeof req.query?.dateFrom === "string" ? new Date(req.query.dateFrom) : null;
    const dateToValue = typeof req.query?.dateTo === "string" ? new Date(req.query.dateTo) : null;

    if (dateFromValue && Number.isNaN(dateFromValue.getTime())) {
      throw new ApiError(400, "Invalid dateFrom");
    }
    if (dateToValue && Number.isNaN(dateToValue.getTime())) {
      throw new ApiError(400, "Invalid dateTo");
    }

    const data = await listPaymentLogs(schoolId, {
      studentName: typeof req.query?.studentName === "string" ? req.query.studentName : null,
      studentId: typeof req.query?.studentId === "string" ? req.query.studentId : null,
      status: typeof req.query?.status === "string" ? req.query.status : null,
      dateFrom: dateFromValue,
      dateTo: dateToValue,
    });
    return success(res, data, "Payment logs fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function downloadAdminReceipt(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const paymentIdParam = req.params?.paymentId;
    const paymentId = Array.isArray(paymentIdParam) ? paymentIdParam[0] : paymentIdParam;
    if (!paymentId) {
      throw new ApiError(400, "paymentId is required");
    }

    const pdfBuffer = await generateAdminReceiptPdf({ schoolId, paymentId });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt_${paymentId}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
}

export async function createManualPaymentRecord(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const parsed = manualPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }

    const data = await createManualPayment({
      ...parsed.data,
      schoolId,
      actorUserId: actor.userId,
    });

    return success(res, data, "Manual payment recorded successfully", 201);
  } catch (error) {
    return next(error);
  }
}
