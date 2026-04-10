import { Prisma, AdmitCardStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { calculateAttendancePercentage } from "@/core/risk/attendanceRisk";
import { normalizeDate } from "@/core/utils/date";
import { logAudit } from "@/utils/audit";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "@/core/cacheService";
import { chunkArray, withConsoleTime, withTiming } from "@/core/utils/perf";
import { getStudentFeeStatus } from "@/modules/fee/fee.service";
import { documentHeaderBuilder } from "@/utils/documentHeader";
import { getSchoolBranding } from "@/utils/schoolBranding";
import { trigger } from "@/modules/notification/service";
import { collectStudentRecipients } from "@/modules/notification/recipientUtils";
import { uploadFile as uploadR2File, buildR2FileUrl, isR2Configured } from "@/services/storage/r2.service";

const PRESENT_STATUSES = ["PRESENT", "LATE", "HALF_DAY", "EXCUSED"] as const;
const ATTENDANCE_THRESHOLD = 75;
const MAX_ADMIT_CARD_BATCH = 20000;
const PDF_BATCH_SIZE = 500;

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type DbClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type EligibilityResult = {
  isLocked: boolean;
  lockReason: string | null;
  isFeePaid: boolean;
  isRegistered: boolean;
  isPublished: boolean;
  canDownloadAdmit: boolean;
  feeStatus: "PENDING" | "PARTIAL" | "PAID";
};

type EnrollmentRow = {
  studentId: string;
  classId: string;
  sectionId: string | null;
  createdAt: Date;
};

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

function buildAdmitCardNumber(examId: string, studentId: string) {
  const examPart = examId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const studentPart = studentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `ADM-${examPart}-${studentPart}`;
}

function buildAdmitCardKey(examId: string, studentId: string, salt?: string | number) {
  const filename = salt ? `${studentId}_${salt}.pdf` : `${studentId}.pdf`;
  return `admit-cards/${examId}/${filename}`;
}

function ensureR2Configured() {
  if (!isR2Configured()) {
    throw new ApiError(500, "R2 storage is not configured");
  }
}

function toSecureFileUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/v1/files/secure")) return value;
  return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}

function formatDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function formatTime(value: Date) {
  return value.toISOString().split("T")[1]?.slice(0, 5) ?? "";
}

async function renderAdmitCardPdf(params: {
  schoolName: string;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolEmail: string | null;
  schoolLogoUrl: string | null;
  studentName: string;
  admissionNumber: string | null;
  registrationNumber: string;
  className: string | null;
  sectionName: string | null;
  rollNumber: number | null;
  examTitle: string;
  admitCardNumber: string;
  timetable: Array<{
    subjectName: string;
    examDate: string;
    startTime: string;
    endTime: string;
    venue: string | null;
  }>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    (async () => {
      // Outer Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

      let currentY = 40;

      // --- HEADER SECTION ---
      await documentHeaderBuilder(doc, {
        schoolName: params.schoolName,
        schoolAddress: params.schoolAddress,
        schoolPhone: params.schoolPhone,
        officialEmail: params.schoolEmail,
        logoUrl: params.schoolLogoUrl,
      }, {
        title: "ADMIT CARD",
        layout: "stacked",
        nameFontSize: 22,
        metaFontSize: 9,
        titleFontSize: 14,
        gapAfter: 0.4,
      });
      currentY = doc.y;

      // Separator Line
      currentY = doc.y + 10;
      doc.moveTo(40, currentY).lineTo(doc.page.width - 40, currentY).stroke();
      currentY += 20;

      // --- DETAILS BLOCK ---
      const leftX = 50;
      const rightX = 260;
      const qrX = doc.page.width - 150;

      // Left: Student Details
      doc.fontSize(10).font("Helvetica-Bold").text("Student Name:", leftX, currentY);
      doc.font("Helvetica").text(params.studentName.toUpperCase(), leftX + 90, currentY);

      doc.font("Helvetica-Bold").text("Registration No:", leftX, currentY + 20);
      doc.font("Helvetica").text(params.registrationNumber, leftX + 90, currentY + 20);

      doc.font("Helvetica-Bold").text("Admission No:", leftX, currentY + 40);
      doc.font("Helvetica").text(params.admissionNumber || "N/A", leftX + 90, currentY + 40);

      doc.font("Helvetica-Bold").text("Class:", leftX, currentY + 60);
      doc.font("Helvetica").text(params.className || "N/A", leftX + 50, currentY + 60);

      doc.font("Helvetica-Bold").text("Section:", leftX, currentY + 80);
      doc.font("Helvetica").text(params.sectionName || "N/A", leftX + 55, currentY + 80);

      doc.font("Helvetica-Bold").text("Roll No:", leftX, currentY + 100);
      doc.font("Helvetica").text(String(params.rollNumber ?? "N/A"), leftX + 50, currentY + 100);

      // Right: Exam Details
      doc.font("Helvetica-Bold").text("Exam Name:", rightX, currentY);
      doc.font("Helvetica").text(params.examTitle, rightX + 75, currentY, { width: qrX - rightX - 80 });

      doc.font("Helvetica-Bold").text("Admit Card No:", rightX, currentY + 35);
      doc.font("Helvetica").text(params.admitCardNumber, rightX + 85, currentY + 35);

      doc.font("Helvetica-Bold").text("Verification Code:", rightX, currentY + 55);
      doc.font("Helvetica").text(params.admitCardNumber, rightX + 105, currentY + 55);

      // QR Code Block
      try {
        const qrBuffer = await QRCode.toBuffer(params.admitCardNumber, { width: 100, margin: 1 });
        doc.image(qrBuffer, qrX, currentY - 5, { width: 100 });
        doc.fontSize(8).font("Helvetica").text("Scan for verification", qrX, currentY + 95, { align: "center", width: 100 });
      } catch (error) {
        doc.rect(qrX, currentY - 5, 100, 100).stroke();
        doc.fontSize(8).font("Helvetica").text("QR Unavailable", qrX, currentY + 40, { align: "center", width: 100 });
      }

      currentY += 140;

      // --- EXAM SCHEDULE TABLE ---
      doc.fontSize(12).font("Helvetica-Bold").text("EXAM SCHEDULE", leftX, currentY);
      currentY += 20;

      const tableColX = [50, 220, 320, 420, 545]; // boundaries for Subject, Date, Time, Venue

      // Table Header
      doc.rect(tableColX[0], currentY, tableColX[4] - tableColX[0], 25).fillAndStroke("#f1f5f9", "#000000");
      doc.fill("#000000").fontSize(10).font("Helvetica-Bold");
      doc.text("Subject", tableColX[0] + 8, currentY + 7);
      doc.text("Date", tableColX[1] + 8, currentY + 7);
      doc.text("Time", tableColX[2] + 8, currentY + 7);
      doc.text("Venue", tableColX[3] + 8, currentY + 7);

      for (let i = 1; i < 4; i++) {
        doc.moveTo(tableColX[i], currentY).lineTo(tableColX[i], currentY + 25).stroke();
      }

      currentY += 25;

      // Table Rows
      doc.font("Helvetica");
      let rowHeight = 25;

      params.timetable.forEach((item) => {
        doc.rect(tableColX[0], currentY, tableColX[4] - tableColX[0], rowHeight).stroke();

        doc.text(item.subjectName, tableColX[0] + 8, currentY + 7, { width: tableColX[1] - tableColX[0] - 16, ellipsis: true });
        doc.text(item.examDate, tableColX[1] + 8, currentY + 7, { width: tableColX[2] - tableColX[1] - 16, ellipsis: true });
        doc.text(`${item.startTime} - ${item.endTime}`, tableColX[2] + 8, currentY + 7, { width: tableColX[3] - tableColX[2] - 16, ellipsis: true });
        doc.text(item.venue ?? "-", tableColX[3] + 8, currentY + 7, { width: tableColX[4] - tableColX[3] - 16, ellipsis: true });

        for (let i = 1; i < 4; i++) {
          doc.moveTo(tableColX[i], currentY).lineTo(tableColX[i], currentY + rowHeight).stroke();
        }

        currentY += rowHeight;
      });

      currentY += 30;

      // --- INSTRUCTIONS ---
      doc.fontSize(11).font("Helvetica-Bold").text("Important Instructions:", leftX, currentY);
      currentY += 20;
      doc.fontSize(10).font("Helvetica");

      const instructions = [
        "Please carry this Admit Card & School ID card to the examination hall every day.",
        "Students must report to the examination hall 15 minutes before the exam start time.",
        "Mobile phones, smartwatches, and all other electronic gadgets are strictly prohibited.",
        "No student will be allowed to leave the examination hall before the halfway mark.",
        "Any use of unfair means will result in immediate disqualification and severe penalties."
      ];

      instructions.forEach((inst) => {
        doc.circle(leftX + 4, currentY + 4, 1.5).fill();
        doc.text(inst, leftX + 15, currentY, { width: doc.page.width - leftX - 60 });
        currentY += 15;
      });

      // --- SIGNATURES ---
      currentY = doc.page.height - 120;

      doc.moveTo(leftX, currentY).lineTo(leftX + 150, currentY).stroke();
      doc.moveTo(doc.page.width - leftX - 150, currentY).lineTo(doc.page.width - leftX, currentY).stroke();

      doc.font("Helvetica-Bold").text("Student's Signature", leftX, currentY + 10, { width: 150, align: "center" });
      doc.text("(Principal / Headmistress)", doc.page.width - leftX - 150, currentY + 10, { width: 150, align: "center" });

      doc.end();
    })().catch((err) => reject(err));
  });
}

async function getExamOrThrow(
  client: DbClient,
  schoolId: string,
  examId: string
): Promise<{
  id: string;
  academicYearId: string;
  termNo: number;
  title: string;
  isPublished: boolean;
  startsOn: Date | null;
  endsOn: Date | null;
}> {
  const exam = await client.exam.findFirst({
    where: { id: examId, schoolId },
    select: {
      id: true,
      academicYearId: true,
      termNo: true,
      title: true,
      isPublished: true,
      startsOn: true,
      endsOn: true,
    },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  return exam;
}

async function getClassIdsForExam(client: DbClient, schoolId: string, examId: string) {
  const examSubjects = await client.examSubject.findMany({
    where: {
      examId,
      exam: { schoolId },
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: { classSubject: { select: { classId: true } } },
  });

  const classIds = new Set<string>();
  for (const subject of examSubjects) {
    classIds.add(subject.classSubject.classId);
  }

  return Array.from(classIds);
}

async function getLatestEnrollments(
  client: DbClient,
  schoolId: string,
  academicYearId: string,
  classIds: string[]
) {
  const enrollments = await client.studentEnrollment.findMany({
    where: {
      classId: { in: classIds },
      academicYearId,
      student: { schoolId, deletedAt: null },
      class: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { studentId: true, classId: true, sectionId: true, createdAt: true },
  });

  const latestEnrollmentByStudent = new Map<string, EnrollmentRow>();
  for (const enrollment of enrollments) {
    if (!latestEnrollmentByStudent.has(enrollment.studentId)) {
      latestEnrollmentByStudent.set(enrollment.studentId, enrollment);
    }
  }

  return latestEnrollmentByStudent;
}

async function getAttendancePercentages(params: {
  client: DbClient;
  schoolId: string;
  academicYearId: string;
  studentIds: string[];
  dateRange: { start: Date; end: Date };
}) {
  const { client, schoolId, academicYearId, studentIds, dateRange } = params;

  if (studentIds.length === 0) {
    return new Map<string, number>();
  }

  const baseWhere = {
    studentId: { in: studentIds },
    academicYearId,
    attendanceDate: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
    student: { schoolId, deletedAt: null },
    section: { class: { schoolId, deletedAt: null }, deletedAt: null },
  } as const;

  const totalByStudent = new Map<string, number>();
  const presentByStudent = new Map<string, number>();

  const chunks = chunkArray(studentIds, 1000);
  for (const chunk of chunks) {
    const chunkWhere = { ...baseWhere, studentId: { in: chunk } };
    const [totalRows, presentRows] = await Promise.all([
      withTiming("admit:attendance:total", () =>
        client.studentAttendance.groupBy({
          by: ["studentId"],
          where: chunkWhere,
          _count: { _all: true },
        })
      ),
      withTiming("admit:attendance:present", () =>
        client.studentAttendance.groupBy({
          by: ["studentId"],
          where: { ...chunkWhere, status: { in: [...PRESENT_STATUSES] } },
          _count: { _all: true },
        })
      ),
    ]);

    for (const row of totalRows) {
      totalByStudent.set(row.studentId, row._count._all);
    }
    for (const row of presentRows) {
      presentByStudent.set(row.studentId, row._count._all);
    }
  }

  const percentages = new Map<string, number>();
  for (const studentId of studentIds) {
    const total = totalByStudent.get(studentId) ?? 0;
    const present = presentByStudent.get(studentId) ?? 0;
    const percentage = calculateAttendancePercentage(total, present);
    percentages.set(studentId, percentage);
  }

  return percentages;
}

async function getStudentAttendanceForExam(params: {
  client: DbClient;
  schoolId: string;
  examId: string;
  studentId: string;
}) {
  const { client, schoolId, examId, studentId } = params;
  const exam = await getExamOrThrow(client, schoolId, examId);
  const academicYear = await client.academicYear.findFirst({
    where: { id: exam.academicYearId, schoolId },
    select: { startDate: true, endDate: true },
  });
  if (!academicYear) {
    throw new ApiError(404, "Academic year not found");
  }

  const rangeStart = exam.startsOn ?? academicYear.startDate;
  const rangeEnd = exam.endsOn ?? academicYear.endDate;
  const start = normalizeDate(rangeStart);
  const end = normalizeDate(rangeEnd);

  const percentages = await getAttendancePercentages({
    client,
    schoolId,
    academicYearId: exam.academicYearId,
    studentIds: [studentId],
    dateRange: { start, end },
  });

  return percentages.get(studentId) ?? 0;
}

async function getFeePaidMap(params: {
  client: DbClient;
  schoolId: string;
  academicYearId: string;
  termNo: number;
  classIds: string[];
  studentIds: string[];
}): Promise<{
  classDueDate: Map<string, Date>;
  defaultDueDate: Date | null;
  paymentsByStudent: Map<string, Date[]>;
}> {
  const { client, schoolId, academicYearId, termNo, classIds, studentIds } = params;

  if (studentIds.length === 0) {
    return { classDueDate: new Map(), defaultDueDate: null, paymentsByStudent: new Map() };
  }

  const feeTerm = await client.feeTerm.findFirst({
    where: { academicYearId, termNo },
    select: { id: true },
  });

  if (!feeTerm) {
    return { classDueDate: new Map(), defaultDueDate: null, paymentsByStudent: new Map() };
  }

  const deadlines = await client.feeDeadline.findMany({
    where: {
      feeTermId: feeTerm.id,
      OR: [{ classId: { in: classIds } }, { classId: null }],
    },
    select: { classId: true, dueDate: true },
  });

  let defaultDueDate: Date | null = null;
  const classDueDate = new Map<string, Date>();
  for (const deadline of deadlines) {
    if (deadline.classId) {
      const existing = classDueDate.get(deadline.classId);
      if (!existing || deadline.dueDate < existing) {
        classDueDate.set(deadline.classId, deadline.dueDate);
      }
    } else {
      if (!defaultDueDate || deadline.dueDate < defaultDueDate) {
        defaultDueDate = deadline.dueDate;
      }
    }
  }

  const payments: { studentId: string; paidAt: Date | null }[] = [];
  const chunks = chunkArray(studentIds, 1000);
  for (const chunk of chunks) {
    const batch = await withTiming("admit:payments", () =>
      client.payment.findMany({
        where: {
          feeTermId: feeTerm.id,
          studentId: { in: chunk },
          status: "PAID",
          paidAt: { not: null },
          student: { schoolId, deletedAt: null },
        },
        select: { studentId: true, paidAt: true },
      })
    );
    payments.push(...batch);
  }

  const paymentsByStudent = new Map<string, Date[]>();
  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const list = paymentsByStudent.get(payment.studentId) ?? [];
    list.push(payment.paidAt);
    paymentsByStudent.set(payment.studentId, list);
  }

  return { classDueDate, defaultDueDate, paymentsByStudent };
}

function computeLockReason(
  attendancePercentage: number,
  feePaid: boolean,
  isRegistered: boolean
) {
  const lowAttendance = attendancePercentage < ATTENDANCE_THRESHOLD;
  const feesPending = !feePaid;
  const notRegistered = !isRegistered;

  const reasons: string[] = [];
  if (lowAttendance) reasons.push("LOW_ATTENDANCE");
  if (feesPending) reasons.push("FEES_PENDING");
  if (notRegistered) reasons.push("NOT_REGISTERED");
  reasons.sort();

  const lockReason = reasons.length > 0 ? reasons.join(",") : null;
  return { isLocked: reasons.length > 0, lockReason };
}

async function ensureAdmitCardPublished(client: DbClient, examId: string) {
  const control = await client.admitCardControl.findFirst({
    where: { examId },
    select: { isPublished: true },
  });

  if (!control?.isPublished) {
    throw new ApiError(403, "Admit card not published yet");
  }
}

async function ensureStudentRegisteredForExam(
  client: DbClient,
  examId: string,
  studentId: string
) {
  const registration = await client.examRegistration.findFirst({
    where: { studentId, examId, status: "REGISTERED" },
    select: { id: true },
  });

  if (!registration) {
    throw new ApiError(403, "Student not registered for exam");
  }
}

export async function computeAdmitCardEligibility(
  schoolId: string,
  examId: string,
  client: DbClient = prisma
): Promise<Map<string, EligibilityResult>> {
  return withConsoleTime(`admit:eligibility:${examId}`, async () => {
    const exam = await getExamOrThrow(client, schoolId, examId);

    if (!exam.isPublished) {
      throw new ApiError(400, "Exam is not published");
    }

    const academicYear = await client.academicYear.findFirst({
      where: { id: exam.academicYearId, schoolId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!academicYear) {
      throw new ApiError(404, "Academic year not found");
    }

    const classIds = await getClassIdsForExam(client, schoolId, examId);
    if (classIds.length === 0) {
      return new Map();
    }

    const latestEnrollmentByStudent = await getLatestEnrollments(
      client,
      schoolId,
      exam.academicYearId,
      classIds
    );

    const studentIds = Array.from(latestEnrollmentByStudent.keys());
    if (studentIds.length === 0) {
      return new Map();
    }

    const cachedEligibility = new Map<string, EligibilityResult>();
    const missingStudentIds: string[] = [];

    for (const studentId of studentIds) {
      const cached = await cacheGet<{ examId: string } & EligibilityResult>(
        `admitEligibility:${studentId}:${examId}`
      );
      if (cached && cached.examId === examId) {
        cachedEligibility.set(studentId, {
          isLocked: cached.isLocked,
          lockReason: cached.lockReason,
          isFeePaid: cached.isFeePaid,
          isRegistered: cached.isRegistered,
          isPublished: cached.isPublished,
          canDownloadAdmit: cached.canDownloadAdmit,
          feeStatus: cached.feeStatus,
        });
      } else {
        missingStudentIds.push(studentId);
      }
    }

    if (missingStudentIds.length === 0) {
      return cachedEligibility;
    }

    const rangeStart = exam.startsOn ?? academicYear.startDate;
    const rangeEnd = exam.endsOn ?? academicYear.endDate;
    const start = normalizeDate(rangeStart);
    const end = normalizeDate(rangeEnd);

    const attendancePercentages = await getAttendancePercentages({
      client,
      schoolId,
      academicYearId: exam.academicYearId,
      studentIds: missingStudentIds,
      dateRange: { start, end },
    });

    const registrations = await client.examRegistration.findMany({
      where: {
        examId,
        studentId: { in: missingStudentIds },
        status: "REGISTERED",
      },
      select: { studentId: true },
    });
    const registeredSet = new Set(registrations.map((row) => row.studentId));

    const feeRecords = await client.feeRecord.findMany({
      where: {
        academicYearId: exam.academicYearId,
        studentId: { in: missingStudentIds },
        isActive: true,
      },
      select: { studentId: true, classId: true, status: true },
    });

    const feePaidByStudent = new Set<string>();
    const feeStatusByStudent = new Map<string, "PENDING" | "PARTIAL" | "PAID">();
    for (const record of feeRecords) {
      const enrollment = latestEnrollmentByStudent.get(record.studentId);
      if (enrollment && enrollment.classId === record.classId) {
        if (record.status === "PAID") {
          feePaidByStudent.add(record.studentId);
        }
        feeStatusByStudent.set(record.studentId, record.status);
      }
    }

    const eligibility = new Map<string, EligibilityResult>(cachedEligibility);

    const control = await client.admitCardControl.findFirst({
      where: { examId },
      select: { isPublished: true },
    });
    const isPublished = Boolean(control?.isPublished);

    for (const studentId of missingStudentIds) {
      const attendancePct = attendancePercentages.get(studentId) ?? 0;

      const feePaid = feePaidByStudent.has(studentId);
      const isRegistered = registeredSet.has(studentId);
      const feeStatus = feeStatusByStudent.get(studentId) ?? "PENDING";

      const { isLocked, lockReason } = computeLockReason(
        attendancePct,
        feePaid,
        isRegistered
      );
      const canDownloadAdmit =
        feePaid && isRegistered && isPublished && attendancePct >= ATTENDANCE_THRESHOLD;
      eligibility.set(studentId, {
        isLocked,
        lockReason,
        isFeePaid: feePaid,
        isRegistered,
        isPublished,
        canDownloadAdmit,
        feeStatus,
      });
    }

    for (const [studentId, entry] of eligibility.entries()) {
      await cacheSet(`admitEligibility:${studentId}:${examId}`, { examId, ...entry }, 90);
    }
    return eligibility;
  });
}

export async function generateAdmitCardsForExam(schoolId: string, examId: string) {
  return prisma.$transaction(async (tx) => {
    const eligibility = await computeAdmitCardEligibility(schoolId, examId, tx);
    const studentIds = Array.from(eligibility.keys());

    if (studentIds.length > MAX_ADMIT_CARD_BATCH) {
      throw new ApiError(400, "Admit card generation batch too large");
    }

    await tx.admitCard.deleteMany({
      where: { examId },
    });

    if (studentIds.length === 0) {
      return { count: 0 };
    }

    const data = studentIds
      .map((studentId) => {
        const entry = eligibility.get(studentId)!;
        if (!entry.isFeePaid || !entry.isRegistered) {
          return null;
        }
        return {
          examId,
          studentId,
          admitCardNumber: buildAdmitCardNumber(examId, studentId),
          status: (entry.isLocked ? "LOCKED" : "UNLOCKED") as AdmitCardStatus,
          lockReason: entry.isLocked ? entry.lockReason : null,
          generatedPdfUrl: null,
          generatedAt: null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    await tx.admitCard.createMany({ data });

    return { count: data.length };
  });
}

async function ensureStudentInExamClass(
  client: DbClient,
  schoolId: string,
  examId: string,
  academicYearId: string,
  studentId: string
) {
  const classIds = await getClassIdsForExam(client, schoolId, examId);
  if (classIds.length === 0) {
    throw new ApiError(404, "Exam has no subjects");
  }

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

  if (!enrollment || !classIds.includes(enrollment.classId)) {
    throw new ApiError(404, "Student not eligible for this exam");
  }

  return enrollment.classId;
}

export async function unlockAdmitCard(
  schoolId: string,
  examId: string,
  studentId: string,
  actor: ActorContext,
  reason?: string | null
) {
  ensureActor(actor);

  const result = await prisma.$transaction(async (tx) => {
    const exam = await getExamOrThrow(tx, schoolId, examId);

    await ensureStudentInExamClass(tx, schoolId, examId, exam.academicYearId, studentId);

    const existing = await tx.admitCard.findFirst({
      where: { examId, studentId },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError(404, "Admit card not found");
    }

    const updated = await tx.admitCard.update({
      where: { id: existing.id },
      data: {
        status: "UNLOCKED",
        lockReason: null,
      },
    });

    await logAudit({
      action: "ADMIT_CARD_UNLOCKED",
      entity: "AdmitCard",
      entityId: existing.id,
      userId: actor.userId,
      metadata: { studentId, examId, previousStatus: "LOCKED", reason: reason ?? null },
    });

    return {
      studentId: updated.studentId,
      examId: updated.examId,
      isLocked: updated.status === "LOCKED",
      lockReason: updated.lockReason,
      pdfUrl: toSecureFileUrl(updated.generatedPdfUrl),
    };
  });

  try {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      select: { title: true },
    });
    await trigger("ADMIT_CARD_UNLOCKED", {
      schoolId,
      studentId,
      sentById: actor.userId ?? undefined,
      metadata: {
        examId,
        examTitle: exam?.title ?? "Exam",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] admit card unlock failed", error);
    }
  }

  return result;
}

async function resolveStudentForActor(
  schoolId: string,
  actor: ActorContext,
  studentIdFromQuery?: string | null
) {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    return student.id;
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    if (studentIdFromQuery) {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: parent.id, studentId: studentIdFromQuery },
        select: { studentId: true },
      });

      if (!link) {
        throw new ApiError(403, "Forbidden");
      }

      return link.studentId;
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { studentId: true },
    });

    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }

    return link.studentId;
  }

  if (isAdminRole(roleType)) {
    if (!studentIdFromQuery) {
      throw new ApiError(400, "studentId is required for admin access");
    }

    return studentIdFromQuery;
  }

  throw new ApiError(403, "Forbidden");
}

export async function getAdmitCardForActor(
  schoolId: string,
  examId: string,
  actor: ActorContext,
  studentIdFromQuery?: string | null
) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);
  const studentId = await resolveStudentForActor(schoolId, actor, studentIdFromQuery);

  const control = await prisma.admitCardControl.findUnique({
    where: { examId },
  });

  if (!control?.isPublished) {
    throw new ApiError(403, "Admit card not published");
  }

  const registration = await prisma.examRegistration.findFirst({
    where: {
      examId,
      studentId,
      status: "REGISTERED",
    },
  });

  if (!registration) {
    throw new ApiError(403, "Not registered");
  }

  const fee = await prisma.feeRecord.findFirst({
    where: {
      studentId,
      academicYearId: exam.academicYearId,
      isActive: true,
    },
  });

  if (!fee || fee.status !== "PAID") {
    throw new ApiError(403, "Fee not paid");
  }

  console.log({
    isPublished: control.isPublished,
    isRegistered: !!registration,
    feeStatus: fee?.status,
    role: actor.roleType,
  });

  // Since eligibility is confirmed locally in real-time, fetch/generate the PDF directly.
  return await generateAdmitCardPDF(schoolId, examId, studentId);
}

export async function generateAdmitCardPDF(
  schoolId: string,
  examId: string,
  studentId: string
) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);

  const control = await prisma.admitCardControl.findUnique({
    where: { examId },
  });

  if (!control?.isPublished) {
    throw new ApiError(403, "Admit card not published");
  }

  const registration = await prisma.examRegistration.findFirst({
    where: {
      examId,
      studentId,
      status: "REGISTERED",
    },
  });

  if (!registration) {
    throw new ApiError(403, "Not registered");
  }

  const feeRecord = await prisma.feeRecord.findFirst({
    where: {
      studentId,
      academicYearId: exam.academicYearId,
      isActive: true,
    },
  });

  if (!feeRecord || feeRecord.status !== "PAID") {
    throw new ApiError(403, "Fee not paid");
  }

  let admitCard = await prisma.admitCard.findFirst({
    where: { examId, studentId },
    select: {
      id: true,
      status: true,
      admitCardNumber: true,
      generatedPdfUrl: true,
      generatingPdf: true,
    },
  });

  if (!admitCard) {
    const examPart = examId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const studentPart = studentId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const admitCardNumber = `ADM-${examPart}-${studentPart}`;

    admitCard = await prisma.admitCard.create({
      data: {
        examId,
        studentId,
        admitCardNumber,
        status: "UNLOCKED",
        lockReason: null,
      },
    });
  }

  let autoUnlocked = false;
  if (admitCard.status === "LOCKED") {
    // If the student meets all conditions now, they should be auto-unlocked because attendance checks are deprecated.
    admitCard = await prisma.admitCard.update({
      where: { id: admitCard.id },
      data: { status: "UNLOCKED", lockReason: null },
      select: {
        id: true,
        status: true,
        admitCardNumber: true,
        generatedPdfUrl: true,
        generatingPdf: true,
      },
    });
    autoUnlocked = true;
  }

  if (autoUnlocked) {
    try {
      await trigger("ADMIT_CARD_UNLOCKED", {
        schoolId,
        studentId,
        metadata: {
          examId,
          examTitle: exam.title ?? "Exam",
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[notify] admit card auto-unlock failed", error);
      }
    }
  }

  if (admitCard.generatingPdf) {
    throw new ApiError(409, "Admit card PDF generation already in progress");
  }

  const lockResult = await prisma.admitCard.updateMany({
    where: {
      id: admitCard.id,
      generatingPdf: false,
    },
    data: { generatingPdf: true },
  });

  if (lockResult.count === 0) {
    const latest = await prisma.admitCard.findFirst({
      where: { id: admitCard.id },
      select: { generatedPdfUrl: true },
    });

    if (latest?.generatedPdfUrl) {
      return {
        studentId,
        examId,
        isLocked: false,
        lockReason: null,
        pdfUrl: toSecureFileUrl(latest.generatedPdfUrl),
      };
    }
  }

  try {
    const [student, enrollment, examSubjects] = await Promise.all([
      prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: {
          id: true,
          fullName: true,
          registrationNumber: true,
          admissionNumber: true,
        },
      }),
      prisma.studentEnrollment.findFirst({
        where: {
          studentId,
          academicYearId: exam.academicYearId,
          student: { schoolId, deletedAt: null },
          class: { schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          rollNumber: true,
          class: { select: { className: true } },
          section: { select: { sectionName: true } },
        },
      }),
      prisma.examSubject.findMany({
        where: { examId, exam: { schoolId } },
        select: {
          classSubject: { select: { subject: { select: { name: true } } } },
          timetable: {
            orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
            select: {
              examDate: true,
              startTime: true,
              endTime: true,
              venue: true,
            },
          },
        },
      }),
    ]);

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const timetable = examSubjects.flatMap((subject) =>
      subject.timetable.map((slot) => ({
        subjectName: subject.classSubject.subject.name,
        examDate: formatDate(slot.examDate),
        startTime: formatTime(slot.startTime),
        endTime: formatTime(slot.endTime),
        venue: slot.venue ?? null,
      }))
    );

    const salt = Date.now();
    const key = buildAdmitCardKey(examId, studentId, salt);

    const branding = await getSchoolBranding(schoolId);

    const pdfBuffer = await renderAdmitCardPdf({
      schoolName: branding.schoolName,
      schoolAddress: branding.schoolAddress,
      schoolPhone: branding.schoolPhone,
      schoolEmail: branding.officialEmail,
      schoolLogoUrl: branding.logoUrl,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber ?? null,
      registrationNumber: student.registrationNumber,
      className: enrollment?.class?.className ?? null,
      sectionName: enrollment?.section?.sectionName ?? null,
      rollNumber: enrollment?.rollNumber ?? null,
      examTitle: exam.title,
      admitCardNumber: admitCard.admitCardNumber,
      timetable,
    });

    ensureR2Configured();
    const uploaded = await uploadR2File(pdfBuffer, key, "application/pdf");
    const fileUrl = buildR2FileUrl(uploaded.bucket, uploaded.key);

    const updated = await prisma.admitCard.update({
      where: { id: admitCard.id },
      data: {
        generatedPdfUrl: fileUrl,
        generatedAt: new Date(),
        generatingPdf: false,
      },
    });

    return {
      studentId: updated.studentId,
      examId: updated.examId,
      isLocked: updated.status === "LOCKED",
      lockReason: updated.lockReason,
      pdfUrl: toSecureFileUrl(updated.generatedPdfUrl),
    };
  } catch (error) {
    await prisma.admitCard.update({
      where: { id: admitCard.id },
      data: { generatingPdf: false },
    });
    throw error;
  }
}

export async function getAdmitCardPdfForActor(
  schoolId: string,
  examId: string,
  actor: ActorContext,
  studentIdFromQuery?: string | null
) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);

  if (!exam.isPublished) {
    throw new ApiError(400, "Exam is not published");
  }

  await ensureAdmitCardPublished(prisma, examId);

  const studentId = await resolveStudentForActor(schoolId, actor, studentIdFromQuery);
  const classId = await ensureStudentInExamClass(
    prisma,
    schoolId,
    examId,
    exam.academicYearId,
    studentId
  );

  await ensureStudentRegisteredForExam(prisma, examId, studentId);

  const feeRecord = await prisma.feeRecord.findFirst({
    where: {
      studentId,
      academicYearId: exam.academicYearId,
      classId,
      isActive: true,
    },
    select: { status: true },
  });
  if (!feeRecord || feeRecord.status !== "PAID") {
    throw new ApiError(403, "Fee not paid. Cannot access admit card");
  }

  const admitCard = await prisma.admitCard.findFirst({
    where: { examId, studentId },
    select: {
      id: true,
      status: true,
      lockReason: true,
      generatedPdfUrl: true,
    },
  });

  if (!admitCard) {
    throw new ApiError(404, "Admit card not found");
  }

  if (admitCard.status === "LOCKED") {
    // Eligibility already verified above (fee paid + registered + published)
    await prisma.admitCard.update({
      where: { id: admitCard.id },
      data: { status: "UNLOCKED", lockReason: null },
    });
  }

  // Temporarily force generation of the new layout so the user can see it! 
  // if (!admitCard.generatedPdfUrl) {
  const freshData = await generateAdmitCardPDF(schoolId, examId, studentId);
  return {
    ...freshData,
    pdfUrl: freshData.pdfUrl ? freshData.pdfUrl : null,
  };
  // }
}

export async function bulkGeneratePDFs(schoolId: string, examId: string) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);

  if (!exam.isPublished) {
    throw new ApiError(400, "Exam is not published");
  }

  const unlocked = await prisma.admitCard.findMany({
    where: { examId, status: "UNLOCKED", generatedPdfUrl: null },
    select: { studentId: true },
  });

  if (unlocked.length === 0) {
    return { count: 0 };
  }

  if (unlocked.length > MAX_ADMIT_CARD_BATCH) {
    throw new ApiError(400, "Admit card PDF batch too large");
  }

  const { default: pLimit } = await import("p-limit");
  const chunks = chunkArray(unlocked, PDF_BATCH_SIZE);
  for (const chunk of chunks) {
    const limit = pLimit(5);
    await Promise.all(
      chunk.map((entry) => limit(() => generateAdmitCardPDF(schoolId, examId, entry.studentId)))
    );
  }

  return { count: unlocked.length };
}

export async function publishAdmitCards(schoolId: string, examId: string) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);

  const control = await prisma.admitCardControl.upsert({
    where: { examId },
    update: { isPublished: true, publishedAt: new Date() },
    create: { examId, isPublished: true, publishedAt: new Date() },
  });

  const registrations = await prisma.examRegistration.findMany({
    where: { examId, status: "REGISTERED" },
    select: { studentId: true },
  });

  await Promise.all(
    registrations.map((row) =>
      cacheInvalidateByPrefix(`admitEligibility:${row.studentId}:${examId}`)
    )
  );

  try {
    const studentIds = registrations.map((row) => row.studentId);
    const recipients = await collectStudentRecipients({ schoolId, studentIds });
    if (recipients.length > 0) {
      await trigger("ADMIT_CARD_PUBLISHED", {
        schoolId,
        userIds: recipients,
        metadata: { examId, examTitle: exam.title },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] admit card publish failed", error);
    }
  }

  return {
    examId: control.examId,
    isPublished: control.isPublished,
    generatedCount: 0,
  };
}

export async function setAdmitCardPublishStatus(
  schoolId: string,
  examId: string,
  isPublished: boolean
) {
  const exam = await getExamOrThrow(prisma, schoolId, examId);

  const control = await prisma.admitCardControl.upsert({
    where: { examId },
    update: {
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
    create: {
      examId,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  });

  const registrations = await prisma.examRegistration.findMany({
    where: { examId, status: "REGISTERED" },
    select: { studentId: true },
  });

  await Promise.all(
    registrations.map((row) =>
      cacheInvalidateByPrefix(`admitEligibility:${row.studentId}:${examId}`)
    )
  );

  if (isPublished) {
    try {
      const studentIds = registrations.map((row) => row.studentId);
      const recipients = await collectStudentRecipients({ schoolId, studentIds });
      if (recipients.length > 0) {
        await trigger("ADMIT_CARD_PUBLISHED", {
          schoolId,
          userIds: recipients,
          metadata: { examId, examTitle: exam.title },
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[notify] admit card publish failed", error);
      }
    }
  }

  return {
    examId: control.examId,
    isPublished: control.isPublished,
    publishedAt: control.publishedAt ?? null,
  };
}

export async function listAdmitCardControls(
  schoolId: string,
  examId?: string | null
) {
  const controls = await prisma.admitCardControl.findMany({
    where: {
      examId: examId ?? undefined,
      exam: { schoolId },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      examId: true,
      isPublished: true,
      publishedAt: true,
      updatedAt: true,
      exam: { select: { title: true, termNo: true } },
    },
  });

  return controls.map((control) => ({
    id: control.id,
    examId: control.examId,
    title: control.exam?.title ?? null,
    termNo: control.exam?.termNo ?? null,
    isPublished: control.isPublished,
    publishedAt: control.publishedAt ?? null,
    updatedAt: control.updatedAt,
  }));
}
