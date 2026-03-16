import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/modules/notification/service", () => ({
  trigger: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { trigger } from "../src/modules/notification/service";
import { markAttendance } from "../src/modules/attendance/service";
import {
  approveAttendanceCorrection,
  requestAttendanceCorrection,
} from "../src/modules/attendance/corrections/service";
import { getStudentMonthlySummary } from "../src/modules/attendance/summaries/service";

const mockedPrisma = vi.mocked(prisma, true);
const mockedTrigger = vi.mocked(trigger);

const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("attendance module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: "section-1",
      classTeacherId: "teacher-1",
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: "student-1" },
    ] as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.systemSetting.findMany.mockResolvedValue([
      { settingKey: "ATTENDANCE_WINDOW_MINUTES", settingValue: 1440 },
      { settingKey: "ATTENDANCE_WARNING_LEVELS", settingValue: [85, 80, 75] },
    ] as never);
    mockedPrisma.period.findFirst.mockResolvedValue({
      startTime: new Date(Date.UTC(1970, 0, 1, 0, 0, 0)),
    } as never);
  });

  it("creates audit logs when marking attendance", async () => {
    mockedPrisma.studentAttendance.create.mockResolvedValue({
      id: "att-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      status: "PRESENT",
      remarks: null,
    } as never);

    mockedPrisma.studentAttendance.count.mockResolvedValue(1 as never);

    const result = await markAttendance(
      schoolId,
      {
        sectionId: "section-1",
        academicYearId: "ay-1",
        timetableSlotId: "slot-1",
        attendanceDate: new Date().toISOString(),
        records: [{ studentId: "student-1", status: "PRESENT" }],
      },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(result).toHaveLength(1);
    expect(mockedPrisma.attendanceAuditLog.createMany).toHaveBeenCalled();
  });

  it("sends absence and threshold notifications when attendance drops", async () => {
    mockedPrisma.studentAttendance.create.mockResolvedValue({
      id: "att-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      status: "ABSENT",
      remarks: null,
    } as never);

    mockedPrisma.studentAttendance.count
      .mockResolvedValueOnce(4 as never)
      .mockResolvedValueOnce(3 as never);

    await markAttendance(
      schoolId,
      {
        sectionId: "section-1",
        academicYearId: "ay-1",
        timetableSlotId: "slot-1",
        attendanceDate: new Date().toISOString(),
        records: [{ studentId: "student-1", status: "ABSENT" }],
      },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(mockedTrigger).toHaveBeenCalledWith(
      "STUDENT_ALERT",
      expect.objectContaining({
        metadata: expect.objectContaining({ eventType: "ATTENDANCE_ABSENT" }),
      })
    );

    expect(mockedTrigger).toHaveBeenCalledWith(
      "STUDENT_ALERT",
      expect.objectContaining({
        metadata: expect.objectContaining({ eventType: "ATTENDANCE_THRESHOLD" }),
      })
    );
  });

  it("blocks non-class teachers from marking attendance", async () => {
    mockedPrisma.section.findFirst
      .mockResolvedValueOnce({
        id: "section-1",
        classTeacherId: "teacher-2",
      } as never)
      .mockResolvedValueOnce(null as never);

    await expect(
      markAttendance(
        schoolId,
        {
          sectionId: "section-1",
          academicYearId: "ay-1",
          timetableSlotId: "slot-1",
          attendanceDate: new Date().toISOString(),
          records: [{ studentId: "student-1", status: "PRESENT" }],
        },
        { roleType: "TEACHER", userId: "user-1" }
      )
    ).rejects.toThrow("Only class teacher can mark attendance");
  });

  it("flags students below 75% attendance as risk", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "ABSENT" },
      { status: "ABSENT" },
      { status: "ABSENT" },
    ] as never);

    const summary = await getStudentMonthlySummary({
      schoolId,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    });

    expect(summary.attendancePercentage).toBe(25);
    expect(summary.riskFlag).toBe(true);
  });

  it("creates correction request", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    mockedPrisma.studentAttendance.findFirst.mockResolvedValue({
      id: "att-1",
      status: "PRESENT",
      attendanceDate: yesterday,
      sectionId: "section-1",
      section: { id: "section-1" },
    } as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({ id: "section-1" } as never);
    mockedPrisma.attendanceCorrection.create.mockResolvedValue({ id: "corr-1" } as never);

    const result = await requestAttendanceCorrection(
      schoolId,
      { attendanceId: "att-1", newStatus: "ABSENT", reason: "Correction" },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(result).toMatchObject({ id: "corr-1" });
    expect(mockedPrisma.attendanceCorrection.create).toHaveBeenCalled();
    expect(mockedPrisma.attendanceAuditLog.create).toHaveBeenCalled();
  });

  it("approves correction and logs audit", async () => {
    mockedPrisma.attendanceCorrection.findFirst.mockResolvedValue({
      id: "corr-1",
      status: "PENDING",
      oldStatus: "PRESENT",
      newStatus: "ABSENT",
      reason: "Correction",
      attendanceId: "att-1",
      attendance: {
        id: "att-1",
        studentId: "student-1",
        academicYearId: "ay-1",
        attendanceDate: new Date(),
      },
    } as never);

    mockedPrisma.studentAttendance.update.mockResolvedValue({ id: "att-1" } as never);
    mockedPrisma.attendanceCorrection.update.mockResolvedValue({ id: "corr-1" } as never);
    mockedPrisma.studentAttendance.count.mockResolvedValueOnce(10 as never);
    mockedPrisma.studentAttendance.count.mockResolvedValueOnce(7 as never);

    const result = await approveAttendanceCorrection(
      schoolId,
      "corr-1",
      { roleType: "ADMIN", userId: "admin-1" },
      { remarks: "Approved" }
    );

    expect(result).toMatchObject({ id: "corr-1" });
    expect(mockedPrisma.studentAttendance.update).toHaveBeenCalled();
    expect(mockedPrisma.attendanceAuditLog.create).toHaveBeenCalled();
  });

  it("calculates student monthly summary", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "ABSENT" },
      { status: "LATE" },
    ] as never);

    const summary = await getStudentMonthlySummary({
      schoolId,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    });

    expect(summary.totalDays).toBe(3);
    expect(summary.presentDays).toBe(2);
    expect(summary.absentDays).toBe(1);
    expect(summary.attendancePercentage).toBeCloseTo(66.67, 2);
    expect(summary.riskFlag).toBe(true);
  });

  it("sets riskFlag false when attendance is above threshold", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ] as never);

    const summary = await getStudentMonthlySummary({
      schoolId,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    });

    expect(summary.attendancePercentage).toBeCloseTo(80, 2);
    expect(summary.riskFlag).toBe(false);
  });

  it("sets riskFlag false when attendance is exactly at threshold", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ] as never);

    const summary = await getStudentMonthlySummary({
      schoolId,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    });

    expect(summary.attendancePercentage).toBeCloseTo(75, 2);
    expect(summary.riskFlag).toBe(false);
  });

  it("sets riskFlag true when attendance is below threshold", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ] as never);

    const summary = await getStudentMonthlySummary({
      schoolId,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    });

    expect(summary.attendancePercentage).toBeCloseTo(66.67, 2);
    expect(summary.riskFlag).toBe(true);
  });
});
