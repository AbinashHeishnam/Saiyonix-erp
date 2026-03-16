import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/utils/jwt", () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
}));

import app from "../src/app";
import prisma from "../src/config/prisma";
import { roleHasPermission } from "../src/modules/auth/permission.service";
import { verifyToken } from "../src/utils/jwt";

const mockedPrisma = vi.mocked(prisma, true);
const mockedVerifyToken = vi.mocked(verifyToken);
const mockedRoleHasPermission = vi.mocked(roleHasPermission);

const teacherPayload = {
  sub: "teacher-user",
  email: "teacher@saiyonix.test",
  roleId: "role-teacher",
  roleType: "TEACHER",
  schoolId: "school-1",
};

const parentPayload = {
  sub: "parent-user",
  email: "parent@saiyonix.test",
  roleId: "role-parent",
  roleType: "PARENT",
  schoolId: "school-1",
};

const studentPayload = {
  sub: "student-user",
  email: "student@saiyonix.test",
  roleId: "role-student",
  roleType: "STUDENT",
  schoolId: "school-1",
};

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
    mockedRoleHasPermission.mockResolvedValue(true as never);
  });

  it("blocks teacher from marking attendance for another class", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload as never);

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.section.findFirst
      .mockResolvedValueOnce({ id: "section-1", classTeacherId: "teacher-2" } as never)
      .mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.period.findFirst.mockResolvedValue({
      startTime: new Date(Date.UTC(1970, 0, 1, 0, 0, 0)),
    } as never);
    mockedPrisma.systemSetting.findMany.mockResolvedValue([
      { settingKey: "ATTENDANCE_WINDOW_MINUTES", settingValue: 1440 },
      { settingKey: "ATTENDANCE_WARNING_LEVELS", settingValue: [85, 80, 75] },
    ] as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);

    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: "11111111-1111-1111-8111-111111111111",
        academicYearId: "22222222-2222-2222-8222-222222222222",
        timetableSlotId: "33333333-3333-3333-8333-333333333333",
        records: [
          {
            studentId: "44444444-4444-4444-8444-444444444444",
            status: "PRESENT",
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(mockedRoleHasPermission).toHaveBeenCalledWith("role-teacher", "attendance:mark");
  });

  it("blocks parent from accessing another student's leave", async () => {
    mockedVerifyToken.mockReturnValue(parentPayload as never);

    mockedPrisma.studentLeave.findFirst.mockResolvedValue({
      id: "55555555-5555-5555-8555-555555555555",
      student: { id: "student-2", userId: "student-2-user" },
      appliedByParent: null,
    } as never);
    mockedPrisma.parent.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.parentStudentLink.findFirst.mockResolvedValue(null as never);

    const response = await request(app)
      .get("/api/v1/student-leaves/55555555-5555-5555-8555-555555555555")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body?.data).toBeUndefined();
    expect(mockedRoleHasPermission).toHaveBeenCalledWith("role-parent", "studentLeave:read");
  });

  it("blocks student from admin actions", async () => {
    mockedVerifyToken.mockReturnValue(studentPayload as never);

    const noticeResponse = await request(app)
      .post("/api/v1/notices")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Notice",
        content: "Content",
        noticeType: "GENERAL",
      });

    expect(noticeResponse.status).toBe(403);

    const notificationResponse = await request(app)
      .post("/api/v1/notifications/send")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Announcement",
        body: "Hello",
        priority: "LOW",
        targetType: "ENTIRE_SCHOOL",
      });

    expect(notificationResponse.status).toBe(403);
  });

  it("blocks teacher from approving leave outside their class", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload as never);

    mockedPrisma.studentLeave.findFirst.mockResolvedValue({
      id: "66666666-6666-6666-8666-666666666666",
      status: "PENDING",
      student: { id: "student-2", userId: "student-2-user" },
      appliedByParent: null,
      fromDate: new Date("2026-03-01"),
      toDate: new Date("2026-03-02"),
      leaveType: null,
      reason: "Sick",
    } as never);

    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue({
      sectionId: "section-2",
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue(null as never);

    const response = await request(app)
      .patch("/api/v1/student-leaves/66666666-6666-6666-8666-666666666666/approve")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(mockedRoleHasPermission).toHaveBeenCalledWith("role-teacher", "studentLeave:update");
  });
});
