import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { cacheInvalidateByPrefix } from "@/core/cacheService";
import { getRazorpayConfig } from "@/core/config/externalServices";
import { getPaymentProvider } from "@/core/payments/provider";
import { retryOnceOnUnique, retryOnceOnUniqueOrSerialization } from "@/core/utils/retry";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";

const DEFAULT_FEE_CATEGORY = "DEFAULT";

type DbClient = typeof prisma;

type FeeStatusResult = {
  baseAmount: number | null;
  scholarshipAmount: number | null;
  discountAmount: number | null;
  lateFee: number | null;
  finalAmount: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  dueDate: Date | null;
  status: "PENDING" | "PARTIAL" | "PAID" | "NOT_PUBLISHED" | "NOT_CREATED";
};

export type FeeOverviewSnapshot = {
  academicYearId: string;
  hasSetup: boolean;
  totalStudents: number;
  totalCollected: number;
  totalPending: number;
  totalFees: number;
  paidStudents: number;
  unpaidStudents: number;
  collectionRate: number;
  termComparison: { term: string; collected: number }[];
  monthlyTrend: { month: string; collected: number }[];
  classWise: { className: string; collected: number; pending: number }[];
  paymentMethodSplit: { method: string; amount: number }[];
  topDefaulters: { studentName: string; className: string | null; pendingAmount: number }[];
};

function toDecimal(value: number | string | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function computeFeeStatus(total: Prisma.Decimal, paid: Prisma.Decimal) {
  if (paid.gte(total)) return "PAID" as const;
  if (paid.gt(0)) return "PARTIAL" as const;
  return "PENDING" as const;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

async function getActiveAcademicYearId(client: DbClient, schoolId: string) {
  const academicYear = await client.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(404, "Active academic year not found");
  }

  return academicYear.id;
}

async function resolveAcademicYearId(
  client: DbClient,
  schoolId: string,
  academicYearId?: string | null,
  academicYearLabel?: string | null
) {
  if (academicYearId) {
    const record = await client.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
      select: { id: true },
    });
    if (!record) {
      throw new ApiError(404, "Academic year not found");
    }
    return record.id;
  }

  if (academicYearLabel) {
    const record = await client.academicYear.findFirst({
      where: { schoolId, label: academicYearLabel },
      select: { id: true },
    });
    if (!record) {
      throw new ApiError(404, "Academic year not found");
    }
    return record.id;
  }

  return getActiveAcademicYearId(client, schoolId);
}

async function resolveScholarshipPercent(
  client: DbClient,
  params: {
    studentId: string;
    classId: string;
    academicYearId: string;
  }
) {
  const student = await client.student.findFirst({
    where: { id: params.studentId },
    select: { admissionNumber: true },
  });

  const enrollment = await client.studentEnrollment.findFirst({
    where: { studentId: params.studentId, academicYearId: params.academicYearId },
    select: { sectionId: true },
  });

  if (student?.admissionNumber) {
    const record = await client.scholarship.findFirst({
      where: {
        academicYearId: params.academicYearId,
        admissionNumber: student.admissionNumber,
      },
      orderBy: { discountPercent: "desc" },
      select: { discountPercent: true },
    });
    if (record?.discountPercent) return record.discountPercent;
  }

  if (enrollment?.sectionId) {
    const record = await client.scholarship.findFirst({
      where: {
        academicYearId: params.academicYearId,
        sectionId: enrollment.sectionId,
        classId: params.classId,
      },
      orderBy: { discountPercent: "desc" },
      select: { discountPercent: true },
    });
    if (record?.discountPercent) return record.discountPercent;
  }

  const record = await client.scholarship.findFirst({
    where: {
      academicYearId: params.academicYearId,
      classId: params.classId,
      sectionId: null,
      admissionNumber: null,
    },
    orderBy: { discountPercent: "desc" },
    select: { discountPercent: true },
  });

  return record?.discountPercent ?? 0;
}

async function resolveDiscountCandidates(
  client: DbClient,
  params: {
    studentId: string;
    classId: string;
    academicYearId: string;
  }
) {
  const enrollment = await client.studentEnrollment.findFirst({
    where: { studentId: params.studentId, academicYearId: params.academicYearId },
    select: { sectionId: true },
  });

  const studentDiscounts = await client.discount.findMany({
    where: {
      academicYearId: params.academicYearId,
      studentId: params.studentId,
    },
    select: { discountValue: true, isPercent: true },
  });
  if (studentDiscounts.length > 0) return studentDiscounts;

  if (enrollment?.sectionId) {
    const sectionDiscounts = await client.discount.findMany({
      where: {
        academicYearId: params.academicYearId,
        classId: params.classId,
        sectionId: enrollment.sectionId,
        studentId: null,
      },
      select: { discountValue: true, isPercent: true },
    });
    if (sectionDiscounts.length > 0) return sectionDiscounts;
  }

  return client.discount.findMany({
    where: {
      academicYearId: params.academicYearId,
      classId: params.classId,
      sectionId: null,
      studentId: null,
    },
    select: { discountValue: true, isPercent: true },
  });
}

async function resolveFeeDueDate(
  client: DbClient,
  academicYearId: string,
  classId: string
) {
  const feeTerm = await client.feeTerm.findFirst({
    where: { academicYearId },
    orderBy: { termNo: "desc" },
    select: { id: true },
  });

  if (!feeTerm) return null;

  const deadline = await client.feeDeadline.findFirst({
    where: {
      feeTermId: feeTerm.id,
      OR: [{ classId }, { classId: null }],
    },
    orderBy: [{ dueDate: "asc" }],
    select: { dueDate: true },
  });

  return deadline?.dueDate ?? null;
}

async function ensureStudentBelongsToSchool(
  client: DbClient,
  schoolId: string,
  studentId: string
) {
  const student = await client.student.findFirst({
    where: { id: studentId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }
}

async function resolveStudentEnrollment(
  client: DbClient,
  schoolId: string,
  studentId: string,
  academicYearId: string
) {
  const enrollment = await client.studentEnrollment.findFirst({
    where: {
      studentId,
      academicYearId,
      student: { schoolId, deletedAt: null },
      class: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { classId: true },
  });

  if (!enrollment) {
    throw new ApiError(404, "Student enrollment not found");
  }

  return enrollment;
}

async function resolveFeeStructure(
  client: DbClient,
  schoolId: string,
  academicYearId: string,
  classId: string,
  category?: string | null
) {
  const structure = await client.feeStructure.findFirst({
    where: {
      schoolId,
      academicYearId,
      classId,
      category: category ?? DEFAULT_FEE_CATEGORY,
    },
    select: { id: true, amount: true, isPublished: true },
  });

  if (!structure) {
    throw new ApiError(404, "Fee structure not found for class");
  }

  return structure;
}

async function computeFeeBreakdown(
  client: DbClient,
  params: {
    studentId: string;
    classId: string;
    academicYearId: string;
    baseAmount: Prisma.Decimal;
  }
) {
  const zero = new Prisma.Decimal(0);

  const [scholarshipPercent, discounts, deadlines] = (await Promise.all([
    resolveScholarshipPercent(client, {
      studentId: params.studentId,
      classId: params.classId,
      academicYearId: params.academicYearId,
    }),
    resolveDiscountCandidates(client, {
      studentId: params.studentId,
      classId: params.classId,
      academicYearId: params.academicYearId,
    }),
    client.feeDeadline.findMany({
      where: {
        feeTerm: { academicYearId: params.academicYearId },
        OR: [{ classId: params.classId }, { classId: null }],
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true, lateFeePercent: true },
    }),
  ])) as [
    number,
    Awaited<ReturnType<typeof resolveDiscountCandidates>>,
    Array<{ dueDate: Date | null; lateFeePercent: Prisma.Decimal | null }>
  ];

  let scholarshipAmount = params.baseAmount
    .mul(new Prisma.Decimal(scholarshipPercent))
    .div(100);
  if (scholarshipAmount.gt(params.baseAmount)) {
    scholarshipAmount = params.baseAmount;
  }

  const afterScholarship = params.baseAmount.minus(scholarshipAmount);

  let bestDiscount = zero;
  for (const item of discounts) {
    const value = toDecimal(item.discountValue);
    let discountAmount = item.isPercent
      ? afterScholarship.mul(value).div(100)
      : value;
    if (discountAmount.gt(afterScholarship)) {
      discountAmount = afterScholarship;
    }
    if (discountAmount.gt(bestDiscount)) {
      bestDiscount = discountAmount;
    }
  }

  let lateFee = zero;
  const now = new Date();
  const expired = deadlines.filter((item) => item.dueDate && now > item.dueDate);
  if (expired.length > 0) {
    const latestExpired = expired[expired.length - 1];
    if (latestExpired.lateFeePercent) {
      const afterDiscount = afterScholarship.minus(bestDiscount);
      lateFee = afterDiscount.mul(latestExpired.lateFeePercent).div(100);
    }
  }

  const afterDiscount = afterScholarship.minus(bestDiscount);
  let finalAmount = afterDiscount.plus(lateFee);
  if (finalAmount.lt(0)) finalAmount = zero;
  return {
    baseAmount: params.baseAmount,
    scholarshipAmount,
    discountAmount: bestDiscount,
    lateFee,
    finalAmount,
  };
}

async function ensureFeeRecordTx(
  tx: Prisma.TransactionClient,
  studentId: string,
  academicYearId: string,
  classId: string,
  totalAmount: Prisma.Decimal
) {
  const db = tx as unknown as DbClient;
  const breakdown = await computeFeeBreakdown(db, {
    studentId,
    classId,
    academicYearId,
    baseAmount: totalAmount,
  });

  await tx.$queryRaw`
    SELECT "id"
    FROM "FeeRecord"
    WHERE "studentId" = ${studentId} AND "academicYearId" = ${academicYearId}
    FOR UPDATE
  `;

  const activeRecords = await tx.feeRecord.findMany({
    where: { studentId, academicYearId, isActive: true },
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      classId: true,
      version: true,
    },
    orderBy: { version: "desc" },
  });

  if (activeRecords.length > 1) {
    const [keep, ...stale] = activeRecords;
    await tx.feeRecord.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: { isActive: false },
    });
    activeRecords.splice(1);
  }

  const existing = activeRecords[0] ?? null;

  if (!existing) {
    return tx.feeRecord.create({
      data: {
        studentId,
        academicYearId,
        classId,
        totalAmount: breakdown.finalAmount,
        paidAmount: new Prisma.Decimal(0),
        status: "PENDING",
        isActive: true,
        version: 1,
      },
    });
  }

  if (existing.classId !== classId) {
    const latestVersion = await tx.feeRecord.findFirst({
      where: { studentId, academicYearId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await tx.feeRecord.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return tx.feeRecord.create({
      data: {
        studentId,
        academicYearId,
        classId,
        previousClassId: existing.classId,
        totalAmount: breakdown.finalAmount,
        paidAmount: new Prisma.Decimal(0),
        status: "PENDING",
        isActive: true,
        version: (latestVersion?.version ?? existing.version ?? 1) + 1,
      },
    });
  }

  const refreshed = await tx.feeRecord.findFirst({
    where: { id: existing.id },
  });

  if (!refreshed) {
    throw new ApiError(404, "Fee record not found");
  }

  return refreshed;
}

export async function createFeeStructure(input: {
  schoolId: string;
  classId: string;
  amount: number;
  academicYearId?: string | null;
  academicYear?: string | null;
  category?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const classRecord = await prisma.class.findFirst({
    where: { id: input.classId, schoolId: input.schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!classRecord) {
    throw new ApiError(404, "Class not found");
  }

  const fee = await prisma.feeStructure.upsert({
    where: {
      academicYearId_classId_category: {
        academicYearId,
        classId: input.classId,
        category: input.category ?? DEFAULT_FEE_CATEGORY,
      },
    },
    update: {
      amount: input.amount,
    },
    create: {
      schoolId: input.schoolId,
      academicYearId,
      classId: input.classId,
      category: input.category ?? DEFAULT_FEE_CATEGORY,
      amount: input.amount,
    },
  });

  return {
    id: fee.id,
    classId: fee.classId,
    amount: Number(fee.amount),
    academicYearId: fee.academicYearId,
    category: fee.category,
  };
}

export async function publishFeeStructure(input: {
  schoolId: string;
  classId: string;
  academicYearId?: string | null;
  academicYear?: string | null;
  category?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const fee = await prisma.feeStructure.findFirst({
    where: {
      schoolId: input.schoolId,
      academicYearId,
      classId: input.classId,
      category: input.category ?? DEFAULT_FEE_CATEGORY,
    },
    select: { id: true },
  });

  if (!fee) {
    throw new ApiError(404, "Fee structure not found for class");
  }

  const updated = await prisma.feeStructure.update({
    where: { id: fee.id },
    data: { isPublished: true },
    select: { id: true, classId: true, academicYearId: true, category: true, isPublished: true },
  });

  await assignFeeToClass({
    schoolId: input.schoolId,
    classId: input.classId,
    academicYearId,
    category: input.category ?? DEFAULT_FEE_CATEGORY,
  });

  try {
    const classRecord = await prisma.class.findFirst({
      where: { id: input.classId, schoolId: input.schoolId, deletedAt: null },
      select: { className: true },
    });
    const recipients = await collectClassRecipients({
      schoolId: input.schoolId,
      classId: input.classId,
    });
    if (recipients.length > 0) {
      await trigger("FEE_PUBLISHED", {
        schoolId: input.schoolId,
        userIds: recipients,
        classId: input.classId,
        className: classRecord?.className ?? undefined,
        metadata: {
          academicYearId,
          category: input.category ?? DEFAULT_FEE_CATEGORY,
        },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] fee publish failed", error);
    }
  }

  return updated;
}

export async function listFeeStructures(input: {
  schoolId: string;
  academicYearId?: string | null;
  classId?: string | null;
  category?: string | null;
  isPublished?: boolean | null;
}) {
  const academicYearId = input.academicYearId ?? null;

  const structures = await prisma.feeStructure.findMany({
    where: {
      schoolId: input.schoolId,
      academicYearId: academicYearId ?? undefined,
      classId: input.classId ?? undefined,
      category: input.category ?? undefined,
      isPublished: input.isPublished ?? undefined,
    },
    orderBy: [{ academicYearId: "desc" }, { classId: "asc" }],
    select: {
      id: true,
      classId: true,
      academicYearId: true,
      category: true,
      amount: true,
      isPublished: true,
      updatedAt: true,
      class: { select: { className: true } },
      academicYear: { select: { label: true } },
    },
  });

  return structures.map((item) => ({
    id: item.id,
    classId: item.classId,
    className: item.class?.className ?? null,
    academicYearId: item.academicYearId,
    academicYear: item.academicYear?.label ?? null,
    category: item.category,
    amount: Number(item.amount),
    isPublished: item.isPublished,
    updatedAt: item.updatedAt,
  }));
}

export async function createScholarship(input: {
  schoolId: string;
  title?: string | null;
  discountPercent?: number | null;
  classId?: string | null;
  sectionId?: string | null;
  admissionNumber?: string | null;
  academicYearId?: string | null;
  academicYear?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const normalizedAdmissionNumber = input.admissionNumber?.trim() || null;
  const normalizedTitle = input.title?.trim() || "Scholarship";
  const hasAdmission = Boolean(normalizedAdmissionNumber);
  const normalizedClassId = hasAdmission ? null : input.classId ?? null;
  const normalizedSectionId = hasAdmission ? null : input.sectionId ?? null;

  if (input.classId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: input.classId, schoolId: input.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!classRecord) throw new ApiError(404, "Class not found");
  }

  if (input.sectionId) {
    const sectionRecord = await prisma.section.findFirst({
      where: { id: input.sectionId, deletedAt: null },
      select: { id: true, classId: true },
    });
    if (!sectionRecord) throw new ApiError(404, "Section not found");
    if (input.classId && sectionRecord.classId !== input.classId) {
      throw new ApiError(400, "Section does not belong to selected class");
    }
  }

  const existing = await prisma.scholarship.findFirst({
    where: {
      academicYearId,
      admissionNumber: hasAdmission ? normalizedAdmissionNumber : null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      title: normalizedTitle,
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "Scholarship already exists for this target", {
      scholarshipId: existing.id,
    });
  }

  let admissionNumber: string | null = normalizedAdmissionNumber;
  let studentSnapshot: { fullName: string | null; registrationNumber: string | null } | null = null;
  if (admissionNumber) {
    const student = await prisma.student.findFirst({
      where: {
        schoolId: input.schoolId,
        admissionNumber,
        deletedAt: null,
      },
      select: { fullName: true, registrationNumber: true },
    });
    if (student) {
      studentSnapshot = student;
    }
  }

  const record = await prisma.scholarship.create({
    data: {
      academicYearId,
      title: normalizedTitle,
      discountPercent: input.discountPercent ?? 0,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      admissionNumber,
    },
    select: {
      id: true,
      academicYearId: true,
      title: true,
      discountPercent: true,
      classId: true,
      sectionId: true,
      admissionNumber: true,
      createdAt: true,
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  return {
    id: record.id,
    academicYearId: record.academicYearId,
    title: record.title,
    discountPercent: record.discountPercent ?? null,
    classId: record.classId ?? null,
    className: record.class?.className ?? null,
    sectionId: record.sectionId ?? null,
    sectionName: record.section?.sectionName ?? null,
    admissionNumber: record.admissionNumber ?? null,
    studentName: studentSnapshot?.fullName ?? null,
    registrationNumber: studentSnapshot?.registrationNumber ?? null,
    createdAt: record.createdAt,
  };
}

export async function listScholarships(input: {
  schoolId: string;
  academicYearId?: string | null;
}) {
  const academicYearId = input.academicYearId ?? undefined;

  const records = await prisma.scholarship.findMany({
    where: {
      academicYearId,
      academicYear: { schoolId: input.schoolId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      academicYearId: true,
      title: true,
      discountPercent: true,
      classId: true,
      sectionId: true,
      admissionNumber: true,
      createdAt: true,
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  const admissionNumbers = records
    .map((record) => record.admissionNumber)
    .filter((value): value is string => Boolean(value));

  const students = admissionNumbers.length
    ? await prisma.student.findMany({
      where: {
        schoolId: input.schoolId,
        admissionNumber: { in: admissionNumbers },
        deletedAt: null,
      },
      select: { admissionNumber: true, fullName: true, registrationNumber: true },
    })
    : [];

  const studentByAdmission = new Map(
    students.map((student) => [student.admissionNumber ?? "", student])
  );

  return records.map((record) => {
    const student = record.admissionNumber
      ? studentByAdmission.get(record.admissionNumber) ?? null
      : null;
    return {
      id: record.id,
      academicYearId: record.academicYearId,
      title: record.title,
      discountPercent: record.discountPercent ?? null,
      classId: record.classId ?? null,
      className: record.class?.className ?? null,
      sectionId: record.sectionId ?? null,
      sectionName: record.section?.sectionName ?? null,
      admissionNumber: record.admissionNumber ?? null,
      studentName: student?.fullName ?? null,
      registrationNumber: student?.registrationNumber ?? null,
      createdAt: record.createdAt,
    };
  });
}

export async function updateScholarship(input: {
  schoolId: string;
  id: string;
  title?: string | null;
  discountPercent?: number | null;
  classId?: string | null;
  sectionId?: string | null;
  admissionNumber?: string | null;
  academicYearId?: string | null;
  academicYear?: string | null;
}) {
  const existing = await prisma.scholarship.findFirst({
    where: {
      id: input.id,
      academicYear: { schoolId: input.schoolId },
    },
    select: { id: true, academicYearId: true },
  });
  if (!existing) {
    throw new ApiError(404, "Scholarship not found");
  }

  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? existing.academicYearId,
    input.academicYear ?? null
  );

  const normalizedAdmissionNumber = input.admissionNumber?.trim() || null;
  const normalizedTitle = input.title?.trim() || "Scholarship";
  const hasAdmission = Boolean(normalizedAdmissionNumber);
  const normalizedClassId = hasAdmission ? null : input.classId ?? null;
  const normalizedSectionId = hasAdmission ? null : input.sectionId ?? null;

  if (input.classId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: input.classId, schoolId: input.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!classRecord) throw new ApiError(404, "Class not found");
  }

  if (input.sectionId) {
    const sectionRecord = await prisma.section.findFirst({
      where: { id: input.sectionId, deletedAt: null },
      select: { id: true, classId: true },
    });
    if (!sectionRecord) throw new ApiError(404, "Section not found");
    if (input.classId && sectionRecord.classId !== input.classId) {
      throw new ApiError(400, "Section does not belong to selected class");
    }
  }

  const duplicate = await prisma.scholarship.findFirst({
    where: {
      id: { not: input.id },
      academicYearId,
      admissionNumber: hasAdmission ? normalizedAdmissionNumber : null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      title: normalizedTitle,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiError(409, "Scholarship already exists for this target", {
      scholarshipId: duplicate.id,
    });
  }

  const record = await prisma.scholarship.update({
    where: { id: input.id },
    data: {
      academicYearId,
      title: normalizedTitle,
      discountPercent: input.discountPercent ?? 0,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      admissionNumber: normalizedAdmissionNumber,
    },
    select: {
      id: true,
      academicYearId: true,
      title: true,
      discountPercent: true,
      classId: true,
      sectionId: true,
      admissionNumber: true,
      createdAt: true,
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  return {
    id: record.id,
    academicYearId: record.academicYearId,
    title: record.title,
    discountPercent: record.discountPercent ?? null,
    classId: record.classId ?? null,
    className: record.class?.className ?? null,
    sectionId: record.sectionId ?? null,
    sectionName: record.section?.sectionName ?? null,
    admissionNumber: record.admissionNumber ?? null,
    createdAt: record.createdAt,
  };
}

export async function createDiscount(input: {
  schoolId: string;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  amount: number;
  isPercent?: boolean | null;
  academicYearId?: string | null;
  academicYear?: string | null;
}) {
  if (input.studentId) {
    await ensureStudentBelongsToSchool(prisma, input.schoolId, input.studentId);
  }

  const normalizedClassId = input.studentId ? null : input.classId ?? null;
  const normalizedSectionId = input.studentId ? null : input.sectionId ?? null;

  if (normalizedClassId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: normalizedClassId, schoolId: input.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!classRecord) throw new ApiError(404, "Class not found");
  }

  if (normalizedSectionId) {
    const sectionRecord = await prisma.section.findFirst({
      where: { id: normalizedSectionId, deletedAt: null },
      select: { id: true, classId: true },
    });
    if (!sectionRecord) throw new ApiError(404, "Section not found");
    if (normalizedClassId && sectionRecord.classId !== normalizedClassId) {
      throw new ApiError(400, "Section does not belong to selected class");
    }
  }

  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const existing = await prisma.discount.findFirst({
    where: {
      academicYearId,
      studentId: input.studentId ?? null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "Discount already exists for this target", {
      discountId: existing.id,
    });
  }

  const record = await prisma.discount.create({
    data: {
      academicYearId,
      studentId: input.studentId ?? null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      discountType: "MANUAL",
      discountValue: new Prisma.Decimal(input.amount),
      isPercent: Boolean(input.isPercent),
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      sectionId: true,
      academicYearId: true,
      discountType: true,
      discountValue: true,
      isPercent: true,
      createdAt: true,
      student: { select: { fullName: true, registrationNumber: true } },
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  return {
    id: record.id,
    studentId: record.studentId,
    studentName: record.student?.fullName ?? null,
    registrationNumber: record.student?.registrationNumber ?? null,
    classId: record.classId ?? null,
    className: record.class?.className ?? null,
    sectionId: record.sectionId ?? null,
    sectionName: record.section?.sectionName ?? null,
    academicYearId: record.academicYearId,
    discountType: record.discountType,
    amount: Number(record.discountValue),
    isPercent: record.isPercent,
    createdAt: record.createdAt,
  };
}

export async function listDiscounts(input: {
  schoolId: string;
  academicYearId?: string | null;
}) {
  const academicYearId = input.academicYearId ?? undefined;

  const records = await prisma.discount.findMany({
    where: {
      academicYearId,
      academicYear: { schoolId: input.schoolId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentId: true,
      classId: true,
      sectionId: true,
      academicYearId: true,
      discountType: true,
      discountValue: true,
      isPercent: true,
      createdAt: true,
      student: { select: { fullName: true, registrationNumber: true } },
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    studentName: record.student?.fullName ?? null,
    registrationNumber: record.student?.registrationNumber ?? null,
    classId: record.classId ?? null,
    className: record.class?.className ?? null,
    sectionId: record.sectionId ?? null,
    sectionName: record.section?.sectionName ?? null,
    academicYearId: record.academicYearId,
    discountType: record.discountType,
    amount: Number(record.discountValue),
    isPercent: record.isPercent,
    createdAt: record.createdAt,
  }));
}

export async function updateDiscount(input: {
  schoolId: string;
  id: string;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  amount: number;
  isPercent?: boolean | null;
  academicYearId?: string | null;
  academicYear?: string | null;
}) {
  const existing = await prisma.discount.findFirst({
    where: {
      id: input.id,
      academicYear: { schoolId: input.schoolId },
    },
    select: { id: true, academicYearId: true },
  });
  if (!existing) {
    throw new ApiError(404, "Discount not found");
  }

  if (input.studentId) {
    await ensureStudentBelongsToSchool(prisma, input.schoolId, input.studentId);
  }

  const normalizedClassId = input.studentId ? null : input.classId ?? null;
  const normalizedSectionId = input.studentId ? null : input.sectionId ?? null;

  if (normalizedClassId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: normalizedClassId, schoolId: input.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!classRecord) throw new ApiError(404, "Class not found");
  }

  if (normalizedSectionId) {
    const sectionRecord = await prisma.section.findFirst({
      where: { id: normalizedSectionId, deletedAt: null },
      select: { id: true, classId: true },
    });
    if (!sectionRecord) throw new ApiError(404, "Section not found");
    if (normalizedClassId && sectionRecord.classId !== normalizedClassId) {
      throw new ApiError(400, "Section does not belong to selected class");
    }
  }

  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? existing.academicYearId,
    input.academicYear ?? null
  );

  const duplicate = await prisma.discount.findFirst({
    where: {
      id: { not: input.id },
      academicYearId,
      studentId: input.studentId ?? null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiError(409, "Discount already exists for this target", {
      discountId: duplicate.id,
    });
  }

  const record = await prisma.discount.update({
    where: { id: input.id },
    data: {
      academicYearId,
      studentId: input.studentId ?? null,
      classId: normalizedClassId,
      sectionId: normalizedSectionId,
      discountValue: new Prisma.Decimal(input.amount),
      isPercent: Boolean(input.isPercent),
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      sectionId: true,
      academicYearId: true,
      discountType: true,
      discountValue: true,
      isPercent: true,
      createdAt: true,
      student: { select: { fullName: true, registrationNumber: true } },
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  return {
    id: record.id,
    studentId: record.studentId,
    studentName: record.student?.fullName ?? null,
    registrationNumber: record.student?.registrationNumber ?? null,
    classId: record.classId ?? null,
    className: record.class?.className ?? null,
    sectionId: record.sectionId ?? null,
    sectionName: record.section?.sectionName ?? null,
    academicYearId: record.academicYearId,
    discountType: record.discountType,
    amount: Number(record.discountValue),
    isPercent: record.isPercent,
    createdAt: record.createdAt,
  };
}

export async function deleteDiscount(input: { schoolId: string; id: string }) {
  const existing = await prisma.discount.findFirst({
    where: {
      id: input.id,
      academicYear: { schoolId: input.schoolId },
    },
    select: { id: true },
  });
  if (!existing) {
    throw new ApiError(404, "Discount not found");
  }
  await prisma.discount.delete({ where: { id: input.id } });
  return { id: input.id };
}

export async function deleteScholarship(input: { schoolId: string; id: string }) {
  const existing = await prisma.scholarship.findFirst({
    where: {
      id: input.id,
      academicYear: { schoolId: input.schoolId },
    },
    select: { id: true },
  });
  if (!existing) {
    throw new ApiError(404, "Scholarship not found");
  }
  await prisma.scholarship.delete({ where: { id: input.id } });
  return { id: input.id };
}

export async function createFeeDeadline(input: {
  schoolId: string;
  dueDate: string;
  lateFeePercent?: number | null;
  classId?: string | null;
  academicYearId?: string | null;
  academicYear?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  let feeTerm = await prisma.feeTerm.findFirst({
    where: { academicYearId },
    orderBy: { termNo: "desc" },
    select: { id: true, termNo: true },
  });

  if (!feeTerm) {
    feeTerm = await prisma.feeTerm.create({
      data: {
        academicYearId,
        termNo: 1,
        title: "Term 1",
      },
      select: { id: true, termNo: true },
    });
  }

  const record = await prisma.feeDeadline.create({
    data: {
      feeTermId: feeTerm.id,
      classId: input.classId ?? null,
      dueDate: new Date(input.dueDate),
      lateFeePercent: input.lateFeePercent ?? null,
    },
    select: {
      id: true,
      classId: true,
      dueDate: true,
      lateFeePercent: true,
      feeTermId: true,
      class: { select: { className: true } },
    },
  });

  return {
    id: record.id,
    classId: record.classId,
    className: record.class?.className ?? null,
    dueDate: record.dueDate,
    lateFeePercent: record.lateFeePercent ? Number(record.lateFeePercent) : null,
    feeTermId: record.feeTermId,
  };
}

export async function listFeeDeadlines(input: {
  schoolId: string;
  academicYearId?: string | null;
}) {
  const academicYearId = input.academicYearId ?? undefined;
  const feeTerm = await prisma.feeTerm.findFirst({
    where: academicYearId ? { academicYearId } : undefined,
    orderBy: { termNo: "desc" },
    select: { id: true },
  });

  if (!feeTerm) {
    return [];
  }

  const deadlines = await prisma.feeDeadline.findMany({
    where: { feeTermId: feeTerm.id },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      classId: true,
      dueDate: true,
      lateFeePercent: true,
      feeTermId: true,
      class: { select: { className: true } },
    },
  });

  return deadlines.map((record) => ({
    id: record.id,
    classId: record.classId,
    className: record.class?.className ?? null,
    dueDate: record.dueDate,
    lateFeePercent: record.lateFeePercent ? Number(record.lateFeePercent) : null,
    feeTermId: record.feeTermId,
  }));
}

export async function listLateFeeRecords(input: {
  schoolId: string;
  academicYearId?: string | null;
  classId?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    null
  );

  const feeTerm = await prisma.feeTerm.findFirst({
    where: { academicYearId },
    orderBy: { termNo: "desc" },
    select: { id: true },
  });

  let dueDate: Date | null = null;
  let feeTermId: string | null = null;
  if (feeTerm) {
    feeTermId = feeTerm.id;
    const deadline = await prisma.feeDeadline.findFirst({
      where: {
        feeTermId: feeTerm.id,
        OR: [{ classId: input.classId ?? undefined }, { classId: null }],
      },
      orderBy: [{ dueDate: "asc" }],
      select: { dueDate: true },
    });
    dueDate = deadline?.dueDate ?? null;
  }

  const feeRecords = await prisma.feeRecord.findMany({
    where: {
      academicYearId,
      classId: input.classId ?? undefined,
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
    },
  });

  const studentIds = Array.from(new Set(feeRecords.map((r) => r.studentId)));
  const classIds = Array.from(new Set(feeRecords.map((r) => r.classId)));

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId: input.schoolId, deletedAt: null },
      select: { id: true, fullName: true, registrationNumber: true, admissionNumber: true },
    }),
    prisma.class.findMany({
      where: { id: { in: classIds }, schoolId: input.schoolId, deletedAt: null },
      select: { id: true, className: true },
    }),
  ]);

  const studentById = new Map(students.map((s) => [s.id, s]));
  const classById = new Map(classes.map((c) => [c.id, c]));

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId,
      studentId: { in: studentIds },
    },
    select: { studentId: true, sectionId: true, rollNumber: true },
  });

  const sectionIds = Array.from(new Set(enrollments.map((e) => e.sectionId)));
  const sections = sectionIds.length
    ? await prisma.section.findMany({
      where: { id: { in: sectionIds }, deletedAt: null },
      select: { id: true, sectionName: true },
    })
    : [];

  const enrollmentByStudent = new Map(enrollments.map((e) => [e.studentId, e]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const now = new Date();
  return feeRecords.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    studentName: studentById.get(record.studentId)?.fullName ?? null,
    registrationNumber: studentById.get(record.studentId)?.registrationNumber ?? null,
    admissionNumber: studentById.get(record.studentId)?.admissionNumber ?? null,
    classId: record.classId,
    className: classById.get(record.classId)?.className ?? null,
    sectionId: enrollmentByStudent.get(record.studentId)?.sectionId ?? null,
    sectionName: enrollmentByStudent.get(record.studentId)?.sectionId
      ? sectionById.get(enrollmentByStudent.get(record.studentId)!.sectionId)?.sectionName ?? null
      : null,
    rollNumber: enrollmentByStudent.get(record.studentId)?.rollNumber ?? null,
    totalAmount: Number(record.totalAmount),
    paidAmount: Number(record.paidAmount),
    status: record.status,
    feeTermId,
    dueDate,
    isLate: Boolean(dueDate && now > dueDate && record.status !== "PAID"),
  }));
}

export async function assignFeeToStudents(input: {
  schoolId: string;
  academicYearId?: string | null;
}) {
  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    null
  );

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId,
      student: { schoolId: input.schoolId, deletedAt: null },
      class: { schoolId: input.schoolId, deletedAt: null },
    },
    select: { studentId: true, classId: true },
  });

  if (enrollments.length === 0) {
    return { count: 0 };
  }

  const classIds = Array.from(new Set(enrollments.map((item) => item.classId)));
  const structures = await prisma.feeStructure.findMany({
    where: {
      schoolId: input.schoolId,
      academicYearId,
      classId: { in: classIds },
      category: DEFAULT_FEE_CATEGORY,
    },
    select: { classId: true, amount: true },
  });

  const amountByClass = new Map(
    structures.map((item) => [item.classId, new Prisma.Decimal(item.amount)])
  );

  let createdCount = 0;
  for (const enrollment of enrollments) {
    const totalAmount = amountByClass.get(enrollment.classId);
    if (!totalAmount) continue;

    await retryOnceOnUniqueOrSerialization(async () => {
      const changed = await prisma.$transaction(
        async (tx) => {
          const db = tx as unknown as DbClient;
          const existing = await tx.feeRecord.findFirst({
            where: { studentId: enrollment.studentId, academicYearId, isActive: true },
          });

          if (existing && existing.classId === enrollment.classId) {
            return false;
          }

          if (existing) {
            await tx.feeRecord.update({
              where: { id: existing.id },
              data: { isActive: false },
            });
          }

          await tx.$queryRaw`
            SELECT "id"
            FROM "FeeRecord"
            WHERE "studentId" = ${enrollment.studentId}
              AND "academicYearId" = ${academicYearId}
            FOR UPDATE
          `;

          const latestVersion = await tx.feeRecord.findFirst({
            where: { studentId: enrollment.studentId, academicYearId },
            orderBy: { version: "desc" },
            select: { version: true },
          });

          const breakdown = await computeFeeBreakdown(db, {
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            academicYearId,
            baseAmount: totalAmount,
          });

          await tx.feeRecord.create({
            data: {
              academicYearId,
              studentId: enrollment.studentId,
              classId: enrollment.classId,
              previousClassId: existing?.classId ?? null,
              totalAmount: breakdown.finalAmount,
              paidAmount: new Prisma.Decimal(0),
              status: "PENDING",
              isActive: true,
              version: (latestVersion?.version ?? existing?.version ?? 0) + 1,
            },
          });

          return true;
        },
        { isolationLevel: "Serializable" }
      );

      if (changed) {
        createdCount += 1;
        await cacheInvalidateByPrefix(`fee:${enrollment.studentId}`);
      }
    });
  }

  return { count: createdCount };
}

async function assignFeeToClass(input: {
  schoolId: string;
  classId: string;
  academicYearId: string;
  category: string;
}) {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId: input.academicYearId,
      classId: input.classId,
      student: { schoolId: input.schoolId, deletedAt: null },
      class: { schoolId: input.schoolId, deletedAt: null },
    },
    select: { studentId: true, classId: true },
  });

  if (enrollments.length === 0) {
    return { count: 0 };
  }

  const structure = await prisma.feeStructure.findFirst({
    where: {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      classId: input.classId,
      category: input.category,
      isPublished: true,
    },
    select: { amount: true },
  });

  if (!structure) {
    return { count: 0 };
  }

  let createdCount = 0;
  const baseAmount = new Prisma.Decimal(structure.amount);

  for (const enrollment of enrollments) {
    await retryOnceOnUniqueOrSerialization(async () => {
      const changed = await prisma.$transaction(
        async (tx) => {
          const db = tx as unknown as DbClient;
          const existing = await tx.feeRecord.findFirst({
            where: {
              studentId: enrollment.studentId,
              academicYearId: input.academicYearId,
              isActive: true,
            },
          });

          if (existing && existing.classId === enrollment.classId) {
            return false;
          }

          if (existing) {
            await tx.feeRecord.update({
              where: { id: existing.id },
              data: { isActive: false },
            });
          }

          await tx.$queryRaw`
            SELECT "id"
            FROM "FeeRecord"
            WHERE "studentId" = ${enrollment.studentId}
              AND "academicYearId" = ${input.academicYearId}
            FOR UPDATE
          `;

          const latestVersion = await tx.feeRecord.findFirst({
            where: { studentId: enrollment.studentId, academicYearId: input.academicYearId },
            orderBy: { version: "desc" },
            select: { version: true },
          });

          const breakdown = await computeFeeBreakdown(db, {
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            academicYearId: input.academicYearId,
            baseAmount,
          });

          await tx.feeRecord.create({
            data: {
              academicYearId: input.academicYearId,
              studentId: enrollment.studentId,
              classId: enrollment.classId,
              previousClassId: existing?.classId ?? null,
              totalAmount: breakdown.finalAmount,
              paidAmount: new Prisma.Decimal(0),
              status: "PENDING",
              isActive: true,
              version: (latestVersion?.version ?? existing?.version ?? 0) + 1,
            },
          });

          return true;
        },
        { isolationLevel: "Serializable" }
      );

      if (changed) {
        createdCount += 1;
        await cacheInvalidateByPrefix(`fee:${enrollment.studentId}`);
      }
    });
  }

  return { count: createdCount };
}

export async function getStudentFeeStatus(
  input: {
  schoolId: string;
  studentId: string;
  academicYearId?: string | null;
  academicYear?: string | null;
  classId?: string | null;
  },
  db: DbClient
): Promise<FeeStatusResult> {
  if (!db) {
    throw new Error("DB client not provided");
  }

  await ensureStudentBelongsToSchool(db, input.schoolId, input.studentId);

  const academicYearId = await resolveAcademicYearId(
    db,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const classId =
    input.classId ??
    (await resolveStudentEnrollment(db, input.schoolId, input.studentId, academicYearId))
      .classId;

  const dueDate = await resolveFeeDueDate(db, academicYearId, classId);

  const structure = await db.feeStructure.findFirst({
    where: {
      schoolId: input.schoolId,
      academicYearId,
      classId,
      category: DEFAULT_FEE_CATEGORY,
    },
    select: { amount: true, isPublished: true },
  });

  if (!structure || !structure.isPublished) {
    return {
      baseAmount: null,
      scholarshipAmount: null,
      discountAmount: null,
      lateFee: null,
      finalAmount: null,
      totalAmount: null,
      paidAmount: null,
      dueDate,
      status: "NOT_PUBLISHED",
    };
  }

  const feeRecord = await db.feeRecord.findFirst({
    where: {
      studentId: input.studentId,
      academicYearId,
      classId,
      isActive: true,
    },
  });

  if (!feeRecord) {
    return {
      baseAmount: null,
      scholarshipAmount: null,
      discountAmount: null,
      lateFee: null,
      finalAmount: null,
      totalAmount: null,
      paidAmount: null,
      dueDate,
      status: "NOT_CREATED",
    };
  }

  const baseAmount = new Prisma.Decimal(structure.amount);
  const breakdown = await computeFeeBreakdown(db, {
    studentId: input.studentId,
    classId,
    academicYearId,
    baseAmount,
  });

  const paidAmount = new Prisma.Decimal(feeRecord.paidAmount);
  let recalculatedTotal = breakdown.finalAmount;
  if (paidAmount.gt(recalculatedTotal)) {
    recalculatedTotal = paidAmount;
  }

  if (!feeRecord.totalAmount.eq(recalculatedTotal)) {
    await db.feeRecord.update({
      where: { id: feeRecord.id },
      data: {
        totalAmount: recalculatedTotal,
        status: paidAmount.gte(recalculatedTotal)
          ? "PAID"
          : paidAmount.gt(0)
            ? "PARTIAL"
            : "PENDING",
      },
    });
  }

  let lateFee = recalculatedTotal
    .minus(baseAmount.minus(breakdown.scholarshipAmount).minus(breakdown.discountAmount));
  if (lateFee.lt(0)) lateFee = new Prisma.Decimal(0);

  const computedStatus = paidAmount.gte(recalculatedTotal)
    ? "PAID"
    : paidAmount.gt(0)
      ? "PARTIAL"
      : "PENDING";

  return {
    baseAmount: Number(baseAmount),
    scholarshipAmount: Number(breakdown.scholarshipAmount),
    discountAmount: Number(breakdown.discountAmount),
    lateFee: Number(lateFee),
    finalAmount: Number(recalculatedTotal),
    totalAmount: Number(recalculatedTotal),
    paidAmount: Number(paidAmount),
    dueDate,
    status: computedStatus,
  };
}

export async function payFee(input: {
  schoolId: string;
  studentId: string;
  amount: number;
  academicYearId?: string | null;
  academicYear?: string | null;
  classId?: string | null;
  payment?: { orderId: string; paymentId: string; signature: string } | null;
}) {
  if (input.amount <= 0) {
    throw new ApiError(400, "Invalid amount");
  }

  await ensureStudentBelongsToSchool(prisma, input.schoolId, input.studentId);

  const academicYearId = await resolveAcademicYearId(
    prisma,
    input.schoolId,
    input.academicYearId ?? null,
    input.academicYear ?? null
  );

  const classId =
    input.classId ??
    (await resolveStudentEnrollment(prisma, input.schoolId, input.studentId, academicYearId))
      .classId;

  const structure = await resolveFeeStructure(
    prisma,
    input.schoolId,
    academicYearId,
    classId,
    DEFAULT_FEE_CATEGORY
  );
  if (!structure.isPublished) {
    throw new ApiError(403, "Fee not published");
  }

  const razorpayConfig = await getRazorpayConfig();
  const razorpayEnabled = razorpayConfig.enabled;
  const provider = getPaymentProvider(razorpayEnabled ? "RAZORPAY" : "MOCK");
  let paymentPayload =
    input.payment?.orderId && input.payment?.paymentId && input.payment?.signature
      ? input.payment
      : null;

  if (!paymentPayload && !razorpayEnabled && process.env.NODE_ENV !== "production") {
    paymentPayload = {
      orderId: `mock_${Date.now()}`,
      paymentId: `mock_${Math.random().toString(36).slice(2, 10)}`,
      signature: "mock",
    };
  }

  if (!paymentPayload) {
    throw new ApiError(400, "Payment verification failed");
  }

  const verified = await provider.verifyPayment(paymentPayload);
  if (!verified) {
    throw new ApiError(400, "Payment verification failed");
  }

  const result = await retryOnceOnUniqueOrSerialization(async () =>
    prisma.$transaction(
      async (tx) => {
        const db = tx as unknown as DbClient;
        const txClient = tx as unknown as Prisma.TransactionClient;
        const feeRecord = await ensureFeeRecordTx(
          txClient,
          input.studentId,
          academicYearId,
          classId,
          new Prisma.Decimal(structure.amount)
        );

        const existing = await tx.feeRecord.findUniqueOrThrow({
          where: { id: feeRecord.id },
        });

        let currentTotal = existing.totalAmount;
        if (existing.status !== "PAID") {
          const breakdown = await computeFeeBreakdown(db, {
            studentId: input.studentId,
            classId,
            academicYearId,
            baseAmount: new Prisma.Decimal(structure.amount),
          });

          if (breakdown.finalAmount.gt(existing.totalAmount)) {
            await tx.feeRecord.update({
              where: { id: existing.id },
              data: {
                totalAmount: breakdown.finalAmount,
              },
            });
            currentTotal = breakdown.finalAmount;
          }
        }

        const idempotent = await tx.payment.findFirst({
          where: { idempotencyKey: paymentPayload.orderId },
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
            createdAt: true,
            studentId: true,
          },
        });
        if (idempotent) {
          if (idempotent.studentId !== input.studentId) {
            throw new ApiError(400, "Invalid payment");
          }
          return { payment: idempotent, fee: existing };
        }

        const paymentAmount = new Prisma.Decimal(input.amount);
        if (paymentAmount.lte(0)) {
          throw new ApiError(400, "Invalid amount");
        }

        if (existing.paidAmount.plus(paymentAmount).gt(currentTotal)) {
          throw new ApiError(400, "Overpayment not allowed");
        }

        const payment = await tx.payment.create({
          data: {
            studentId: input.studentId,
            amount: paymentAmount,
            method: "OTHER",
            status: "PAID",
            paidAt: new Date(),
            gatewayOrderId: paymentPayload.orderId,
            gatewayPaymentId: paymentPayload.paymentId,
            gatewaySignature: paymentPayload.signature,
            idempotencyKey: paymentPayload.orderId,
            items: {
              create: [
                {
                  feeStructureId: structure.id,
                  description: "Fee payment",
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
            gatewayOrderId: true,
            gatewayPaymentId: true,
            createdAt: true,
            studentId: true,
          },
        });

        const newPaid = existing.paidAmount.plus(paymentAmount);

        const updated = await tx.feeRecord.update({
          where: { id: feeRecord.id },
          data: {
            paidAmount: newPaid,
            status: newPaid.gte(currentTotal)
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

        if (payment.gatewayPaymentId) {
          await tx.paymentLog.updateMany({
            where: {
              paymentId: null,
              transactionId: payment.gatewayPaymentId,
              status: "SUCCESS",
            },
            data: {
              paymentId: payment.id,
            },
          });
        }

        return { payment, fee: updated, previousStatus: existing.status };
      },
      { isolationLevel: "Serializable" }
    )
  );

  await cacheInvalidateByPrefix(`fee:${input.studentId}`);
  await cacheInvalidateByPrefix(`admitEligibility:${input.studentId}:`);

  if (result.previousStatus !== "PAID" && result.fee.status === "PAID") {
    try {
      await trigger("FEE_STATUS_UPDATED", {
        schoolId: input.schoolId,
        studentId: input.studentId,
        metadata: {
          academicYearId,
          status: result.fee.status,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[notify] fee status update failed", error);
      }
    }
  }

  const baseAmount = new Prisma.Decimal(structure.amount);
  const breakdown = await computeFeeBreakdown(prisma, {
    studentId: input.studentId,
    classId,
    academicYearId,
    baseAmount,
  });
  let lateFee = new Prisma.Decimal(result.fee.totalAmount)
    .minus(baseAmount.minus(breakdown.scholarshipAmount).minus(breakdown.discountAmount));
  if (lateFee.lt(0)) lateFee = new Prisma.Decimal(0);

  return {
    payment: {
      id: result.payment.id,
      amount: Number(result.payment.amount),
      status: result.payment.status,
      method: result.payment.method,
      transactionId: result.payment.gatewayOrderId ?? result.payment.id,
      createdAt: result.payment.createdAt,
    },
    fee: {
      baseAmount: Number(baseAmount),
      scholarshipAmount: Number(breakdown.scholarshipAmount),
      discountAmount: Number(breakdown.discountAmount),
      lateFee: Number(lateFee),
      finalAmount: Number(result.fee.totalAmount),
      totalAmount: Number(result.fee.totalAmount),
      paidAmount: Number(result.fee.paidAmount),
      status: result.fee.status,
    },
  };
}

export async function createPaymentOrder() {
  const provider = getPaymentProvider("MOCK");
  return provider.createOrder(0);
}

export async function verifyPaymentSignature() {
  const provider = getPaymentProvider("MOCK");
  const verified = await provider.verifyPayment({
    orderId: "mock",
    paymentId: "mock",
    signature: "mock",
  });
  return { verified };
}

export async function getFeeRecordForStudent(input: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  classId: string;
}) {
  return prisma.feeRecord.findFirst({
    where: {
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      classId: input.classId,
      isActive: true,
    },
  });
}

export async function listStudentReceipts(input: {
  schoolId: string;
  studentId: string;
}) {
  const payments = await prisma.payment.findMany({
    where: {
      studentId: input.studentId,
      student: { schoolId: input.schoolId, deletedAt: null },
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      gatewayOrderId: true,
      createdAt: true,
      receipt: {
        select: {
          receiptNumber: true,
          pdfUrl: true,
        },
      },
      student: {
        select: {
          id: true,
          fullName: true,
          registrationNumber: true,
        },
      },
    },
  });

  return payments.map((payment) => ({
    payment: {
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      transactionId: payment.gatewayOrderId ?? payment.id,
      createdAt: payment.createdAt,
    },
    receipt: {
      number: payment.receipt?.receiptNumber ?? null,
      pdfUrl: payment.receipt?.pdfUrl ?? null,
    },
    student: payment.student,
  }));
}

export async function getStudentReceiptDetail(input: {
  schoolId: string;
  studentId: string;
  paymentId: string;
}) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: input.paymentId,
      studentId: input.studentId,
      student: { schoolId: input.schoolId, deletedAt: null },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      gatewayOrderId: true,
      createdAt: true,
      receipt: {
        select: {
          receiptNumber: true,
          pdfUrl: true,
        },
      },
      student: {
        select: {
          id: true,
          fullName: true,
          registrationNumber: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(404, "Receipt not found");
  }

  const feeStatus = await getStudentFeeStatus(
    {
      schoolId: input.schoolId,
      studentId: input.studentId,
    },
    prisma
  );

  return {
    payment: {
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      transactionId: payment.gatewayOrderId ?? payment.id,
      createdAt: payment.createdAt,
    },
    receipt: {
      number: payment.receipt?.receiptNumber ?? null,
      pdfUrl: payment.receipt?.pdfUrl ?? null,
    },
    fee: {
      totalAmount: feeStatus.totalAmount ?? 0,
      paidAmount: feeStatus.paidAmount ?? 0,
      status: feeStatus.status,
    },
    student: payment.student,
  };
}

export async function isFeePaid(input: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  classId: string;
}) {
  const feeRecord = await getFeeRecordForStudent(input);
  return feeRecord?.status === "PAID";
}

export async function getFeeOverviewSnapshot(
  schoolId: string,
  academicYearId?: string | null
): Promise<FeeOverviewSnapshot> {
  const resolvedAcademicYearId =
    academicYearId ?? (await getActiveAcademicYearId(prisma, schoolId));

  const [feeStructureCount, feeTermCount, feeRecordCount] = await Promise.all([
    prisma.feeStructure.count({
      where: { academicYearId: resolvedAcademicYearId, schoolId },
    }),
    prisma.feeTerm.count({
      where: {
        academicYearId: resolvedAcademicYearId,
        academicYear: { schoolId },
      },
    }),
    prisma.feeRecord.count({
      where: { academicYearId: resolvedAcademicYearId, isActive: true },
    }),
  ]);

  const hasSetup = feeStructureCount > 0 || feeTermCount > 0 || feeRecordCount > 0;

  if (!hasSetup) {
    return {
      academicYearId: resolvedAcademicYearId,
      hasSetup: false,
      totalStudents: 0,
      totalCollected: 0,
      totalPending: 0,
      totalFees: 0,
      paidStudents: 0,
      unpaidStudents: 0,
      collectionRate: 0,
      termComparison: [],
      monthlyTrend: [],
      classWise: [],
      paymentMethodSplit: [],
      topDefaulters: [],
    };
  }

  const [
    totalStudents,
    feeTotals,
    paidStudentsGroup,
    paymentTotals,
    termTotals,
    feeTerms,
    classTotals,
    classes,
    paymentMethodTotals,
    monthlyTrendRows,
    topDefaultersRows,
  ] = await Promise.all([
    prisma.studentEnrollment.count({
      where: {
        academicYearId: resolvedAcademicYearId,
        student: { schoolId, deletedAt: null },
      },
    }),
    prisma.feeRecord.aggregate({
      where: { academicYearId: resolvedAcademicYearId, isActive: true },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.feeRecord.groupBy({
      by: ["studentId"],
      where: { academicYearId: resolvedAcademicYearId, isActive: true, status: "PAID" },
    }),
    prisma.payment.aggregate({
      where: {
        status: "PAID",
        paidAt: { not: null },
        student: { schoolId },
        feeTerm: { academicYearId: resolvedAcademicYearId },
      },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["feeTermId"],
      where: {
        status: "PAID",
        paidAt: { not: null },
        student: { schoolId },
        feeTerm: { academicYearId: resolvedAcademicYearId },
        feeTermId: { not: null },
      },
      _sum: { amount: true },
    }),
    prisma.feeTerm.findMany({
      where: { academicYearId: resolvedAcademicYearId },
      select: { id: true, title: true, termNo: true },
      orderBy: { termNo: "asc" },
    }),
    prisma.feeRecord.groupBy({
      by: ["classId"],
      where: { academicYearId: resolvedAcademicYearId, isActive: true },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.class.findMany({
      where: { schoolId, academicYearId: resolvedAcademicYearId, deletedAt: null },
      select: { id: true, className: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        status: "PAID",
        paidAt: { not: null },
        student: { schoolId },
        feeTerm: { academicYearId: resolvedAcademicYearId },
      },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ month: string; collected: Prisma.Decimal }[]>`
      SELECT to_char(date_trunc('month', p."paidAt"), 'Mon') AS "month",
             COALESCE(SUM(p."amount"), 0) AS "collected"
      FROM "Payment" p
      INNER JOIN "Student" s ON s.id = p."studentId"
      INNER JOIN "FeeTerm" ft ON ft.id = p."feeTermId"
      WHERE p."status" = 'PAID'
        AND p."paidAt" IS NOT NULL
        AND s."schoolId" = ${schoolId}
        AND ft."academicYearId" = ${resolvedAcademicYearId}
      GROUP BY date_trunc('month', p."paidAt")
      ORDER BY date_trunc('month', p."paidAt") ASC
    `,
    prisma.$queryRaw<
      { studentName: string; className: string | null; pendingAmount: Prisma.Decimal }[]
    >`
      SELECT s."fullName" AS "studentName",
             c."className" AS "className",
             (fr."totalAmount" - fr."paidAmount") AS "pendingAmount"
      FROM "FeeRecord" fr
      INNER JOIN "Student" s ON s.id = fr."studentId"
      LEFT JOIN "Class" c ON c.id = fr."classId"
      WHERE fr."academicYearId" = ${resolvedAcademicYearId}
        AND fr."isActive" = true
        AND fr."status" <> 'PAID'
        AND s."schoolId" = ${schoolId}
        AND s."deletedAt" IS NULL
      ORDER BY (fr."totalAmount" - fr."paidAmount") DESC
      LIMIT 10
    `,
  ]);

  const totalFees = toNumber(feeTotals._sum.totalAmount);
  const totalCollected = toNumber(paymentTotals._sum.amount);
  const totalPending = Math.max(totalFees - totalCollected, 0);
  const paidStudents = paidStudentsGroup.length;
  const unpaidStudents = Math.max(totalStudents - paidStudents, 0);
  const collectionRate = totalFees > 0 ? Number(((totalCollected / totalFees) * 100).toFixed(2)) : 0;

  const termTotalsMap = new Map(
    termTotals.map((row) => [row.feeTermId as string, toNumber(row._sum.amount)])
  );
  const termComparison = feeTerms.map((term) => ({
    term: term.title || `Term ${term.termNo}`,
    collected: termTotalsMap.get(term.id) ?? 0,
  }));

  const classMap = new Map(classes.map((cls) => [cls.id, cls.className ?? "Class"]));
  const classWise = classTotals.map((row) => {
    const totalAmount = toNumber(row._sum.totalAmount);
    const paidAmount = toNumber(row._sum.paidAmount);
    return {
      className: classMap.get(row.classId as string) ?? "Class",
      collected: paidAmount,
      pending: Math.max(totalAmount - paidAmount, 0),
    };
  });

  const paymentMethodSplit = paymentMethodTotals.map((row) => ({
    method: row.method,
    amount: toNumber(row._sum.amount),
  }));

  const monthlyTrend = monthlyTrendRows.map((row) => ({
    month: row.month,
    collected: toNumber(row.collected),
  }));

  const topDefaulters = topDefaultersRows.map((row) => ({
    studentName: row.studentName,
    className: row.className,
    pendingAmount: toNumber(row.pendingAmount),
  }));

  return {
    academicYearId: resolvedAcademicYearId,
    hasSetup: true,
    totalStudents,
    totalCollected,
    totalPending,
    totalFees,
    paidStudents,
    unpaidStudents,
    collectionRate,
    termComparison,
    monthlyTrend,
    classWise,
    paymentMethodSplit,
    topDefaulters,
  };
}
