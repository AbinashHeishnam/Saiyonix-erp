import { trigger as triggerNotification } from "../notification/service";

export async function notifyAbsence(params: {
  schoolId: string;
  studentId: string;
  attendanceDate: Date;
  actorUserId: string;
}) {
  await triggerNotification("STUDENT_ALERT", {
    schoolId: params.schoolId,
    studentId: params.studentId,
    title: "Student Marked Absent",
    body: `Student marked absent on ${params.attendanceDate
      .toISOString()
      .slice(0, 10)}.`,
    sentById: params.actorUserId,
    metadata: {
      eventType: "ATTENDANCE_ABSENT",
      attendanceDate: params.attendanceDate.toISOString().slice(0, 10),
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
    metadata: {
      eventType: "ATTENDANCE_THRESHOLD",
      threshold: params.threshold,
      beforePercentage: params.beforePercentage,
      afterPercentage: params.afterPercentage,
    },
  });
}
