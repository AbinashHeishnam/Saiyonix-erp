import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/modules/notification/service", () => ({
  trigger: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { approveStudentLeave, getStudentLeaveById } from "../src/modules/studentLeave/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

describe("student leave service authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks parent access to unrelated student leave", async () => {
    mockedPrisma.studentLeave.findFirst.mockResolvedValue({
      id: "leave-1",
      student: { id: "student-1", userId: "student-user" },
      appliedByParent: null,
    } as never);

    mockedPrisma.parent.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.parentStudentLink.findFirst.mockResolvedValue(null as never);

    await expect(
      getStudentLeaveById(
        schoolId,
        "leave-1",
        { userId: "parent-user", roleType: "PARENT" }
      )
    ).rejects.toThrow("Forbidden");
  });

  it("blocks teacher from approving leave for non-class student", async () => {
    mockedPrisma.studentLeave.findFirst.mockResolvedValue({
      id: "leave-1",
      status: "PENDING",
      student: { id: "student-1", userId: "student-user" },
      appliedByParent: null,
      fromDate: new Date(),
      toDate: new Date(),
      leaveType: null,
      reason: "Sick",
    } as never);

    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue({
      sectionId: "section-1",
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue(null as never);

    await expect(
      approveStudentLeave(
        schoolId,
        "leave-1",
        { userId: "teacher-user", roleType: "TEACHER" }
      )
    ).rejects.toThrow("Forbidden");
  });
});
