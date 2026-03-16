import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import { markAttendance } from "../src/modules/attendance/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("attendance -> notification flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: "section-1",
      classTeacherId: "teacher-1",
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.period.findFirst.mockResolvedValue({
      startTime: new Date(Date.UTC(1970, 0, 1, 0, 0, 0)),
    } as never);
    mockedPrisma.systemSetting.findMany.mockResolvedValue([
      { settingKey: "ATTENDANCE_WINDOW_MINUTES", settingValue: 1440 },
      { settingKey: "ATTENDANCE_WARNING_LEVELS", settingValue: [85, 80, 75] },
    ] as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: "student-1" },
    ] as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.attendanceAuditLog.createMany.mockResolvedValue({ count: 1 } as never);

    mockedPrisma.studentAttendance.create.mockResolvedValue({
      id: "att-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      status: "ABSENT",
      attendanceDate: new Date(),
      remarks: null,
    } as never);

    mockedPrisma.studentAttendance.count
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(0 as never);

    mockedPrisma.student.findMany.mockResolvedValue([
      {
        userId: "student-user",
        parentLinks: [
          { parent: { userId: "parent-user", schoolId } },
        ],
      },
    ] as never);

    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);
    mockedPrisma.notificationRecipient.createMany.mockResolvedValue({ count: 2 } as never);
  });

  it("creates attendance and notifies parent + student on absence", async () => {
    const result = await markAttendance(
      schoolId,
      {
        sectionId: "section-1",
        academicYearId: "ay-1",
        timetableSlotId: "slot-1",
        records: [{ studentId: "student-1", status: "ABSENT" }],
      },
      { roleType: "TEACHER", userId: "teacher-user" }
    );

    expect(result).toHaveLength(1);
    expect(mockedPrisma.studentAttendance.create).toHaveBeenCalled();
    expect(mockedPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Student Marked Absent",
        }),
      })
    );
    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "student-user" }),
          expect.objectContaining({ userId: "parent-user" }),
        ]),
      })
    );
  });
});
