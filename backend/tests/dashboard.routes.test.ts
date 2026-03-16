import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
}));

vi.mock("../src/utils/jwt", () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("../src/modules/attendance/summaries/service", () => ({
  getStudentMonthlySummary: vi.fn(),
  getStudentMonthlySummaries: vi.fn(),
}));

import app from "../src/app";
import prisma from "../src/config/prisma";
import { roleHasPermission } from "../src/modules/auth/permission.service";
import {
  getStudentMonthlySummary,
  getStudentMonthlySummaries,
} from "../src/modules/attendance/summaries/service";
import { verifyToken } from "../src/utils/jwt";

const mockedPrisma = vi.mocked(prisma, true);
const mockedVerifyToken = vi.mocked(verifyToken);
const mockedRoleHasPermission = vi.mocked(roleHasPermission);
const mockedGetStudentMonthlySummary = vi.mocked(getStudentMonthlySummary);
const mockedGetStudentMonthlySummaries = vi.mocked(getStudentMonthlySummaries);

const schoolId = "school-1";

const studentPayload = {
  sub: "user-student",
  email: "student@saiyonix.test",
  roleId: "role-student",
  roleType: "STUDENT",
  schoolId,
};

const teacherPayload = {
  sub: "user-teacher",
  email: "teacher@saiyonix.test",
  roleId: "role-teacher",
  roleType: "TEACHER",
  schoolId,
};

const parentPayload = {
  sub: "user-parent",
  email: "parent@saiyonix.test",
  roleId: "role-parent",
  roleType: "PARENT",
  schoolId,
};

function setupTransactions() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("dashboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRoleHasPermission.mockResolvedValue(true);
    setupTransactions();

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.noticeBoard.findMany.mockResolvedValue([] as never);
    mockedPrisma.noticeBoard.count.mockResolvedValue(0 as never);
    mockedPrisma.circular.findMany.mockResolvedValue([] as never);
    mockedPrisma.circular.count.mockResolvedValue(0 as never);
    mockedPrisma.notificationRecipient.count.mockResolvedValue(0 as never);
    mockedGetStudentMonthlySummary.mockResolvedValue({
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      halfDays: 0,
      excusedDays: 0,
      attendancePercentage: 0,
      riskFlag: false,
      studentId: "student-1",
      academicYearId: "ay-1",
      month: 1,
      year: 2026,
    } as never);
    mockedGetStudentMonthlySummaries.mockResolvedValue(
      new Map([
        [
          "student-1",
          {
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            halfDays: 0,
            excusedDays: 0,
            attendancePercentage: 0,
            riskFlag: false,
            studentId: "student-1",
            academicYearId: "ay-1",
            month: 1,
            year: 2026,
          },
        ],
      ]) as never
    );
    mockedPrisma.studentAttendance.findFirst.mockResolvedValue(null as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue({
      classId: "class-1",
      sectionId: "section-1",
    } as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: "student-1", classId: "class-1", sectionId: "section-1" },
    ] as never);
    mockedPrisma.parent.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.parentStudentLink.findMany.mockResolvedValue([
      { studentId: "student-1" },
    ] as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.section.findMany.mockResolvedValue([
      { id: "section-1", classId: "class-1" },
    ] as never);
    mockedPrisma.timetableSlot.findMany.mockResolvedValue([
      {
        dayOfWeek: [
          "SUNDAY",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
        ][new Date().getUTCDay()],
        period: { periodNumber: 1 },
        classSubject: { subject: { name: "Math" } },
        section: { sectionName: "A", class: { className: "Class 1" } },
        teacher: { fullName: "Teacher One" },
      },
    ] as never);
  });

  it("GET /dashboard/student returns data", async () => {
    mockedVerifyToken.mockReturnValue(studentPayload);

    const response = await request(app)
      .get("/api/v1/dashboard/student")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("attendanceSummary");
    expect(response.body.data).toHaveProperty("todaysAttendanceStatus");
    expect(response.body.data).toHaveProperty("pendingTasks");
    expect(response.body.data).toHaveProperty("duesSummary");
    expect(response.body.data).toHaveProperty("recentNotices");
    expect(response.body.data).toHaveProperty("recentCirculars");
    expect(response.body.data).toHaveProperty("unreadNotificationsCount");
  });

  it("GET /dashboard/teacher returns data", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .get("/api/v1/dashboard/teacher")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("todaysClasses");
    expect(response.body.data).toHaveProperty("attendancePendingClasses");
    expect(response.body.data).toHaveProperty("atRiskStudents");
    expect(response.body.data).toHaveProperty("recentNotices");
    expect(response.body.data).toHaveProperty("recentCirculars");
    expect(response.body.data).toHaveProperty("unreadNotificationsCount");
  });

  it("GET /dashboard/parent returns data", async () => {
    mockedVerifyToken.mockReturnValue(parentPayload);

    const response = await request(app)
      .get("/api/v1/dashboard/parent")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("children");
    expect(response.body.data).toHaveProperty("upcomingFeeDues");
    expect(response.body.data).toHaveProperty("recentNotices");
    expect(response.body.data).toHaveProperty("recentCirculars");
    expect(response.body.data).toHaveProperty("unreadNotificationsCount");
  });

  it("blocks unauthorized access", async () => {
    const response = await request(app).get("/api/v1/dashboard/student");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
