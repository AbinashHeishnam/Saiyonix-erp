import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

import { PaymentService } from "@/core/services/payment.service";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { documentHeaderBuilder } from "@/utils/documentHeader";
import { getSchoolBranding } from "@/utils/schoolBranding";

import type { CreateOrderInput, VerifyPaymentInput, ManualPaymentInput } from "@/modules/payment/validation";
import { getStudentFeeStatus } from "@/modules/fee/fee.service";
import { cacheInvalidateByPrefix } from "@/core/cacheService";
import { trigger } from "@/modules/notification/service";

type PdfDocument = InstanceType<typeof PDFDocument>;

export async function createPaymentOrder(input: CreateOrderInput, schoolId: string) {
  let amount = input.amount;

  if (input.studentId) {
    const feeStatus = await getStudentFeeStatus(
      {
        schoolId,
        studentId: input.studentId,
        academicYearId: input.academicYearId ?? null,
        academicYear: input.academicYear ?? null,
        classId: input.classId ?? null,
      },
      prisma
    );

    if (feeStatus.status === "NOT_PUBLISHED" || feeStatus.status === "NOT_CREATED") {
      throw new ApiError(400, "Fee record not available");
    }

    const total = feeStatus.totalAmount ?? 0;
    const paid = feeStatus.paidAmount ?? 0;
    const remaining = Math.max(total - paid, 0);

    if (remaining <= 0) {
      throw new ApiError(400, "Fee already paid");
    }

    if (amount === undefined) {
      amount = remaining;
    } else if (amount > remaining) {
      throw new ApiError(400, "Overpayment not allowed");
    }
  }

  if (!amount || amount <= 0) {
    throw new ApiError(400, "Invalid amount");
  }

  const amountInPaise = Math.round(amount * 100);
  return PaymentService.createPaymentOrder({
    amount: amountInPaise,
    currency: input.currency ?? "INR",
    receipt: input.receipt,
    metadata: input.metadata as Record<string, string | number | null> | undefined,
  });
}

export async function verifyPaymentSignature(input: VerifyPaymentInput) {
  return PaymentService.verifyPaymentSignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
}

export async function createPaymentLog(input: {
  paymentId?: string | null;
  studentId: string;
  studentName: string;
  rollNumber: string;
  amount: number;
  transactionId?: string | null;
  status: "SUCCESS" | "FAILED";
  method: string;
  source?: "SYSTEM" | "ADMIN_MANUAL";
  errorMessage?: string | null;
}) {
  return prisma.paymentLog.create({
    data: {
      paymentId: input.paymentId ?? null,
      studentId: input.studentId,
      studentName: input.studentName,
      rollNumber: input.rollNumber,
      amount: input.amount,
      transactionId: input.transactionId ?? null,
      status: input.status,
      method: input.method,
      source: input.source ?? "SYSTEM",
      errorMessage: input.errorMessage ?? null,
    },
  });
}

export async function listPaymentLogs(
  schoolId: string,
  filters: {
    studentName?: string | null;
    studentId?: string | null;
    status?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }
) {
  const where: Prisma.PaymentLogWhereInput = {
    student: {
      schoolId,
      deletedAt: null,
    },
  };

  if (filters.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters.studentName) {
    where.studentName = {
      contains: filters.studentName,
      mode: "insensitive",
    };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const items = await prisma.paymentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const missingPaymentIds = items.filter((item) => !item.paymentId && item.transactionId);
  if (missingPaymentIds.length > 0) {
    const transactionIds = Array.from(new Set(missingPaymentIds.map((item) => item.transactionId!)));
    const payments = await prisma.payment.findMany({
      where: {
        student: { schoolId, deletedAt: null },
        OR: [
          { gatewayPaymentId: { in: transactionIds } },
          { gatewayOrderId: { in: transactionIds } },
          { id: { in: transactionIds } },
        ],
      },
      select: { id: true, gatewayPaymentId: true, gatewayOrderId: true },
    });
    const paymentByTxn = new Map<string, string>();
    for (const payment of payments) {
      if (payment.gatewayPaymentId) paymentByTxn.set(payment.gatewayPaymentId, payment.id);
      if (payment.gatewayOrderId) paymentByTxn.set(payment.gatewayOrderId, payment.id);
      paymentByTxn.set(payment.id, payment.id);
    }
    return items.map((item) => ({
      ...item,
      paymentId: item.paymentId ?? (item.transactionId ? paymentByTxn.get(item.transactionId) ?? null : null),
    }));
  }

  return items;
}

export async function listPayments(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = {
    student: {
      schoolId,
      deletedAt: null,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, registrationNumber: true } },
        feeTerm: { select: { id: true, termNo: true, title: true } },
        receipt: true,
      },
      orderBy: { createdAt: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total };
}

function buildPdfBuffer(build: (doc: PdfDocument) => void | Promise<void>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
    Promise.resolve(build(doc))
      .then(() => doc.end())
      .catch((err) => reject(err));
  });
}

export async function getAdminPaymentReceiptPayload(input: {
  schoolId: string;
  paymentId: string;
}) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: input.paymentId,
      student: { schoolId: input.schoolId, deletedAt: null },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      gatewayOrderId: true,
      gatewayPaymentId: true,
      paidAt: true,
      createdAt: true,
      feeTerm: {
        select: {
          id: true,
          termNo: true,
          title: true,
          academicYear: { select: { id: true, label: true } },
        },
      },
      receipt: { select: { receiptNumber: true, issuedAt: true } },
      student: {
        select: {
          id: true,
          fullName: true,
          registrationNumber: true,
          admissionNumber: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  if (payment.status !== "PAID") {
    throw new ApiError(400, "Receipt available only for paid payments");
  }

  const academicYearId = payment.feeTerm?.academicYear?.id ?? null;
  const enrollment = academicYearId
    ? await prisma.studentEnrollment.findFirst({
      where: { studentId: payment.student.id, academicYearId },
      select: {
        class: { select: { className: true } },
        section: { select: { sectionName: true } },
      },
    })
    : null;

  const feeStatus =
    academicYearId
      ? await getStudentFeeStatus(
        { schoolId: input.schoolId, studentId: payment.student.id, academicYearId },
        prisma
      )
      : null;

  return {
    payment: {
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      transactionId: payment.gatewayPaymentId ?? payment.gatewayOrderId ?? payment.id,
      paidAt: payment.paidAt ?? payment.createdAt,
    },
    receipt: {
      number: payment.receipt?.receiptNumber ?? `RCT-${payment.id.slice(0, 6)}`,
      issuedAt: payment.receipt?.issuedAt ?? payment.createdAt,
    },
    student: {
      id: payment.student.id,
      fullName: payment.student.fullName ?? "Student",
      registrationNumber: payment.student.registrationNumber ?? null,
      admissionNumber: payment.student.admissionNumber ?? null,
      className: enrollment?.class?.className ?? null,
      sectionName: enrollment?.section?.sectionName ?? null,
    },
    fee: feeStatus
      ? {
        totalAmount: feeStatus.totalAmount ?? 0,
        paidAmount: feeStatus.paidAmount ?? 0,
        status: feeStatus.status,
      }
      : { totalAmount: 0, paidAmount: 0, status: "UNKNOWN" },
    term: {
      title: payment.feeTerm?.title ?? null,
      termNo: payment.feeTerm?.termNo ?? null,
      academicYear: payment.feeTerm?.academicYear?.label ?? null,
    },
  };
}

export async function generateAdminReceiptPdf(input: {
  schoolId: string;
  paymentId: string;
}) {
  const payload = await getAdminPaymentReceiptPayload(input);
  const branding = await getSchoolBranding(input.schoolId);

  const buffer = await buildPdfBuffer(async (doc) => {
    await documentHeaderBuilder(doc, branding, {
      title: "Payment Receipt",
      layout: "stacked",
      nameFontSize: 18,
      metaFontSize: 9,
      titleFontSize: 16,
      gapAfter: 0.6,
    });

    doc.fillColor("#000");
    doc.fontSize(12).text(`Receipt No: ${payload.receipt.number}`);
    doc.text(`Issued At: ${new Date(payload.receipt.issuedAt).toLocaleString("en-IN")}`);
    doc.text(`Payment ID: ${payload.payment.id}`);
    doc.text(`Transaction ID: ${payload.payment.transactionId}`);
    doc.moveDown();

    doc.fontSize(12).text("Student Details", { underline: true });
    doc.text(`Name: ${payload.student.fullName}`);
    if (payload.student.registrationNumber) {
      doc.text(`Registration No: ${payload.student.registrationNumber}`);
    }
    if (payload.student.admissionNumber) {
      doc.text(`Admission No: ${payload.student.admissionNumber}`);
    }
    if (payload.student.className || payload.student.sectionName) {
      doc.text(
        `Class/Section: ${payload.student.className ?? "—"} / ${payload.student.sectionName ?? "—"}`
      );
    }
    doc.moveDown();

    doc.fontSize(12).text("Fee Details", { underline: true });
    doc.text(`Fee Term: ${payload.term.title ?? "—"} ${payload.term.termNo ? `(Term ${payload.term.termNo})` : ""}`);
    doc.text(`Academic Year: ${payload.term.academicYear ?? "—"}`);
    doc.text(`Total Fee: ₹${payload.fee.totalAmount.toFixed(2)}`);
    doc.text(`Paid Amount: ₹${payload.fee.paidAmount.toFixed(2)}`);
    doc.text(`Fee Status: ${payload.fee.status}`);
    doc.moveDown();

    doc.fontSize(12).text("Payment Summary", { underline: true });
    doc.text(`Amount Paid: ₹${payload.payment.amount.toFixed(2)}`);
    doc.text(`Method: ${payload.payment.method}`);
    doc.text(`Paid At: ${new Date(payload.payment.paidAt).toLocaleString("en-IN")}`);
    doc.text(`Status: ${payload.payment.status}`);
  });

  return buffer;
}

export async function createManualPayment(
  input: ManualPaymentInput & { schoolId: string; actorUserId: string }
) {
  if (input.method === "ONLINE" && !input.transactionId) {
    throw new ApiError(400, "transactionId is required for online payments");
  }

  const feeTerm = await prisma.feeTerm.findFirst({
    where: {
      id: input.feeTermId,
      academicYear: { schoolId: input.schoolId },
    },
    select: { id: true, academicYearId: true },
  });
  if (!feeTerm) {
    throw new ApiError(404, "Fee term not found");
  }

  const student = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId: input.schoolId, deletedAt: null },
    select: { id: true, fullName: true, registrationNumber: true },
  });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId: input.studentId, academicYearId: feeTerm.academicYearId },
    select: { classId: true, sectionId: true, rollNumber: true },
  });
  if (!enrollment) {
    throw new ApiError(404, "Student enrollment not found for fee term");
  }

  const feeRecord = await prisma.feeRecord.findFirst({
    where: {
      studentId: input.studentId,
      academicYearId: feeTerm.academicYearId,
      classId: enrollment.classId,
      isActive: true,
    },
  });
  if (!feeRecord) {
    throw new ApiError(404, "Fee record not found");
  }

  if (feeRecord.status === "PAID") {
    await createPaymentLog({
      studentId: input.studentId,
      studentName: student.fullName ?? "Student",
      rollNumber: enrollment.rollNumber?.toString() ?? student.registrationNumber ?? "—",
      amount: input.amount,
      transactionId: input.transactionId ?? null,
      status: "FAILED",
      method: input.method,
      source: "ADMIN_MANUAL",
      errorMessage: "Fee already paid",
    });
    throw new ApiError(409, "Fee already paid");
  }

  const totalAmount = new Prisma.Decimal(feeRecord.totalAmount);
  const paidAmount = new Prisma.Decimal(feeRecord.paidAmount);
  const paymentAmount = new Prisma.Decimal(input.amount);

  if (paymentAmount.lte(0)) {
    throw new ApiError(400, "Invalid amount");
  }

  if (paidAmount.plus(paymentAmount).gt(totalAmount)) {
    throw new ApiError(400, "Overpayment not allowed");
  }

  const feeStructure = await prisma.feeStructure.findFirst({
    where: {
      schoolId: input.schoolId,
      academicYearId: feeTerm.academicYearId,
      classId: enrollment.classId,
      category: "DEFAULT",
    },
    select: { id: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        studentId: input.studentId,
        feeTermId: feeTerm.id,
        amount: paymentAmount,
        method: input.method === "ONLINE" ? "ONLINE" : "CASH",
        status: "PAID",
        paidAt: new Date(),
        gatewayPaymentId: input.transactionId ?? null,
        gatewayOrderId: input.transactionId ? `manual_${Date.now()}` : null,
        items: {
          create: [
            {
              feeStructureId: feeStructure?.id ?? null,
              description: "Manual fee payment",
              amount: paymentAmount,
            },
          ],
        },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        gatewayPaymentId: true,
        createdAt: true,
      },
    });

    const newPaid = paidAmount.plus(paymentAmount);

    const updatedFee = await tx.feeRecord.update({
      where: { id: feeRecord.id },
      data: {
        paidAmount: newPaid,
        status: newPaid.gte(totalAmount)
          ? "PAID"
          : newPaid.gt(0)
            ? "PARTIAL"
            : "PENDING",
      },
    });

    await tx.feeTransaction.create({
      data: {
        feeRecordId: feeRecord.id,
        amount: paymentAmount,
        type: "PAYMENT",
      },
    });

    await tx.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber: `RCT-${Date.now()}-${payment.id.slice(0, 6)}`,
      },
    });

    await tx.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        action: "ADMIN_MANUAL_PAYMENT",
        actorUserId: input.actorUserId,
        metadata: {
          method: input.method,
          transactionId: input.transactionId ?? null,
        },
      },
    });

    return { payment, fee: updatedFee };
  });

  await createPaymentLog({
    paymentId: result.payment.id,
    studentId: input.studentId,
    studentName: student.fullName ?? "Student",
    rollNumber: enrollment.rollNumber?.toString() ?? student.registrationNumber ?? "—",
    amount: input.amount,
    transactionId: input.transactionId ?? null,
    status: "SUCCESS",
    method: input.method,
    source: "ADMIN_MANUAL",
  });

  await cacheInvalidateByPrefix(`fee:${input.studentId}`);
  await cacheInvalidateByPrefix(`admitEligibility:${input.studentId}:`);

  if (result.fee.status === "PAID") {
    try {
      await trigger("FEE_STATUS_UPDATED", {
        schoolId: input.schoolId,
        studentId: input.studentId,
        sentById: input.actorUserId,
        metadata: {
          academicYearId: feeTerm.academicYearId,
          status: result.fee.status,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[notify] fee status update failed", error);
      }
    }
  }

  return {
    payment: result.payment,
    fee: result.fee,
  };
}
