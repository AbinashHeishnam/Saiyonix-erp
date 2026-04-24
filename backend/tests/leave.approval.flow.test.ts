import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import { approveStudentLeave, createStudentLeave } from "../src/modules/studentLeave/service";

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

describe("leave approval flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentLeave.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: "leave-1",
        status: "PENDING",
        student: { id: "student-1", userId: "student-user" },
        appliedByParent: null,
        fromDate: new Date("2026-03-01"),
        toDate: new Date("2026-03-01"),
        leaveType: null,
        reason: "Sick",
      } as never);

    mockedPrisma.studentLeave.create.mockResolvedValue({
      id: "leave-1",
      studentId: "student-1",
      fromDate: new Date("2026-03-01"),
      toDate: new Date("2026-03-01"),
      leaveType: null,
      status: "PENDING",
    } as never);

    mockedPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" } as never);

    mockedPrisma.studentEnrollment.findFirst
      .mockResolvedValueOnce({
        section: { classTeacher: { userId: "teacher-user" } },
      } as never)
      .mockResolvedValueOnce({ sectionId: "section-1" } as never)
      .mockResolvedValueOnce({ sectionId: "section-1", academicYearId: "ay-1" } as never);

    mockedPrisma.user.findUnique.mockImplementation(async (args) => {
      const id = (args as { where?: { id?: string } }).where?.id ?? null;
      if (!id) return null as never;
      return { id, schoolId } as never;
    });

    mockedPrisma.user.findMany.mockImplementation(async (args) => {
      const where = (args as { where?: any }).where ?? {};
      const roles = where?.role?.roleType?.in;
      if (Array.isArray(roles)) {
        return [{ id: "admin-1" }] as never;
      }
      const ids = where?.id?.in;
      if (Array.isArray(ids)) {
        return ids.map((id: string) => ({ id })) as never;
      }
      return [] as never;
    });

    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.section.findFirst
      .mockResolvedValueOnce({ id: "section-1" } as never)
      .mockResolvedValueOnce({ classTeacherId: "teacher-1" } as never);

    mockedPrisma.studentLeave.update.mockResolvedValue({
      id: "leave-1",
      status: "APPROVED",
    } as never);

    mockedPrisma.timetableSlot.findMany.mockResolvedValue([
      { id: "slot-1", dayOfWeek: 1 },
    ] as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.studentAttendance.createMany.mockResolvedValue({ count: 1 } as never);

    mockedPrisma.parentStudentLink.findMany.mockResolvedValue([] as never);
    mockedPrisma.notificationRecipient.findMany.mockResolvedValue([] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);
    mockedPrisma.notificationRecipient.createMany.mockResolvedValue({ count: 1 } as never);
  });

  it("creates leave, approves it, logs audit, and notifies requester", async () => {
    const created = await createStudentLeave(
      schoolId,
      {
        studentId: "student-1",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-01"),
        reason: "Sick",
      },
      { roleType: "STUDENT", userId: "student-user" }
    );

    expect(created.status).toBe("PENDING");

    const approved = await approveStudentLeave(
      schoolId,
      "leave-1",
      { roleType: "TEACHER", userId: "teacher-user" }
    );

    expect(approved.status).toBe("APPROVED");
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "APPROVE",
          entity: "StudentLeave",
          entityId: "leave-1",
        }),
      })
    );
    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "student-user" }),
        ]),
      })
    );
  });
});
