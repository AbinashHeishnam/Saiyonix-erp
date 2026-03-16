import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import { DEFAULT_ATTENDANCE_THRESHOLDS } from "../../../core/risk/attendanceRisk";
import { normalizeDate } from "../../../core/utils/date";
import type { AttendanceSummary } from "../types";

const PRESENT_STATUSES = ["PRESENT", "LATE", "HALF_DAY", "EXCUSED"] as const;

function buildMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function getWarningLevels(rawWarnings: unknown): number[] {
  const warningLevels = Array.isArray(rawWarnings)
    ? rawWarnings.filter((value) => typeof value === "number")
    : [...DEFAULT_ATTENDANCE_THRESHOLDS];

  return warningLevels.length > 0 ? warningLevels : [...DEFAULT_ATTENDANCE_THRESHOLDS];
}

const RISK_THRESHOLD = 75;

async function getRiskThreshold(schoolId: string): Promise<number> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      schoolId,
      settingKey: { in: ["ATTENDANCE_WARNING_LEVELS"] },
    },
    select: { settingKey: true, settingValue: true },
  });

  const byKey = new Map(settings.map((item) => [item.settingKey, item.settingValue]));
  const warningLevels = getWarningLevels(byKey.get("ATTENDANCE_WARNING_LEVELS"));

  return warningLevels.includes(RISK_THRESHOLD) ? RISK_THRESHOLD : RISK_THRESHOLD;
}

function summarizeStatusCounts(
  statuses: string[],
  riskThreshold: number
): AttendanceSummary {
  const summary: AttendanceSummary = {
    totalDays: statuses.length,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    excusedDays: 0,
    attendancePercentage: 0,
    riskFlag: false,
  };

  for (const status of statuses) {
    if (status === "ABSENT") {
      summary.absentDays += 1;
      continue;
    }
    if (status === "LATE") {
      summary.lateDays += 1;
    }
    if (status === "HALF_DAY") {
      summary.halfDays += 1;
    }
    if (status === "EXCUSED") {
      summary.excusedDays += 1;
    }
    summary.presentDays += 1;
  }

  summary.attendancePercentage = summary.totalDays
    ? Math.round((summary.presentDays / summary.totalDays) * 10000) / 100
    : 0;
  summary.riskFlag = summary.attendancePercentage < riskThreshold;

  return summary;
}

function createEmptySummary(): AttendanceSummary {
  return {
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    excusedDays: 0,
    attendancePercentage: 0,
    riskFlag: false,
  };
}

function applyStatusCount(summary: AttendanceSummary, status: string, count: number) {
  summary.totalDays += count;

  if (status === "ABSENT") {
    summary.absentDays += count;
    return;
  }

  if (status === "LATE") {
    summary.lateDays += count;
  }

  if (status === "HALF_DAY") {
    summary.halfDays += count;
  }

  if (status === "EXCUSED") {
    summary.excusedDays += count;
  }

  summary.presentDays += count;
}

function finalizeSummary(summary: AttendanceSummary, riskThreshold: number) {
  summary.attendancePercentage = summary.totalDays
    ? Math.round((summary.presentDays / summary.totalDays) * 10000) / 100
    : 0;
  summary.riskFlag = summary.attendancePercentage < riskThreshold;
}

export async function getStudentMonthlySummary(params: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  month: number;
  year: number;
}): Promise<
  AttendanceSummary & {
    studentId: string;
    academicYearId: string;
    month: number;
    year: number;
  }
> {
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const { start, end } = buildMonthRange(params.year, params.month);

  const records = await prisma.studentAttendance.findMany({
    where: {
      studentId: params.studentId,
      academicYearId: params.academicYearId,
      attendanceDate: { gte: start, lte: end },
      student: { schoolId: params.schoolId, deletedAt: null },
      section: { class: { schoolId: params.schoolId, deletedAt: null }, deletedAt: null },
    },
    select: { status: true },
  });

  const riskThreshold = await getRiskThreshold(params.schoolId);
  const summary = summarizeStatusCounts(
    records.map((item) => item.status),
    riskThreshold
  );

  return {
    studentId: params.studentId,
    academicYearId: params.academicYearId,
    month: params.month,
    year: params.year,
    ...summary,
  };
}

export async function getStudentMonthlySummaries(params: {
  schoolId: string;
  studentIds: string[];
  academicYearId: string;
  month: number;
  year: number;
}): Promise<
  Map<
    string,
    AttendanceSummary & {
      studentId: string;
      academicYearId: string;
      month: number;
      year: number;
    }
  >
> {
  if (params.studentIds.length === 0) {
    return new Map();
  }

  const { start, end } = buildMonthRange(params.year, params.month);
  const riskThreshold = await getRiskThreshold(params.schoolId);

  const grouped = await prisma.studentAttendance.groupBy({
    by: ["studentId", "status"],
    where: {
      studentId: { in: params.studentIds },
      academicYearId: params.academicYearId,
      attendanceDate: { gte: start, lte: end },
      student: { schoolId: params.schoolId, deletedAt: null },
      section: { class: { schoolId: params.schoolId, deletedAt: null }, deletedAt: null },
    },
    _count: { _all: true },
  });

  const summaries = new Map<string, AttendanceSummary>();

  for (const row of grouped) {
    const current = summaries.get(row.studentId) ?? createEmptySummary();
    applyStatusCount(current, String(row.status), row._count._all);
    summaries.set(row.studentId, current);
  }

  for (const studentId of params.studentIds) {
    const summary = summaries.get(studentId) ?? createEmptySummary();
    finalizeSummary(summary, riskThreshold);
    summaries.set(studentId, summary);
  }

  const result = new Map<
    string,
    AttendanceSummary & { studentId: string; academicYearId: string; month: number; year: number }
  >();
  for (const [studentId, summary] of summaries.entries()) {
    result.set(studentId, {
      studentId,
      academicYearId: params.academicYearId,
      month: params.month,
      year: params.year,
      ...summary,
    });
  }

  return result;
}

export async function getSchoolAttendanceSummary(params: {
  schoolId: string;
  academicYearId: string;
  date?: string;
}): Promise<
  AttendanceSummary & {
    date: string;
    academicYearId: string;
  }
> {
  const date = params.date ? normalizeDate(new Date(params.date)) : normalizeDate(new Date());
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date");
  }

  const records = await prisma.studentAttendance.findMany({
    where: {
      academicYearId: params.academicYearId,
      attendanceDate: date,
      student: { schoolId: params.schoolId, deletedAt: null },
      section: { class: { schoolId: params.schoolId, deletedAt: null }, deletedAt: null },
    },
    select: { status: true },
  });

  const riskThreshold = await getRiskThreshold(params.schoolId);
  const summary = summarizeStatusCounts(
    records.map((item) => item.status),
    riskThreshold
  );

  return {
    academicYearId: params.academicYearId,
    date: date.toISOString().slice(0, 10),
    ...summary,
  };
}

export { PRESENT_STATUSES };
