import prisma from "@/core/db/prisma";
import { formatLocalDate } from "@/core/utils/localDate";
import { trigger as triggerNotification } from "@/modules/notification/service";

export async function notifyAbsence(params: {
  schoolId: string;
  studentId: string;
  attendanceDate: Date;
  actorUserId: string;
}) {
  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const dateLabel = formatLocalDate(params.attendanceDate, timeZone);
  await triggerNotification("STUDENT_ALERT", {
    schoolId: params.schoolId,
    studentId: params.studentId,
    title: "Student Marked Absent",
    body: `Student marked absent on ${dateLabel}.`,
    sentById: params.actorUserId,
    entityType: "ATTENDANCE",
    linkUrl: "/attendance",
    metadata: {
      eventType: "ATTENDANCE_ABSENT",
      attendanceDate: dateLabel,
    },
  });
}

export async function notifyThresholdDrop(params: {
  schoolId: string;
  studentId: string;
  threshold: number;
  beforePercentage: number;
  afterPercentage: number;
  actorUserId: string;
}) {
  await triggerNotification("STUDENT_ALERT", {
    schoolId: params.schoolId,
    studentId: params.studentId,
    title: "Attendance Warning",
    body:
      params.threshold === 75
        ? "Attendance dropped below 75%. Detention risk warning."
        : `Attendance dropped below ${params.threshold}%. Please monitor attendance.`,
    sentById: params.actorUserId,
    entityType: "ATTENDANCE",
    linkUrl: "/attendance",
    metadata: {
      eventType: "ATTENDANCE_THRESHOLD",
      threshold: params.threshold,
      beforePercentage: params.beforePercentage,
      afterPercentage: params.afterPercentage,
    },
  });
}
