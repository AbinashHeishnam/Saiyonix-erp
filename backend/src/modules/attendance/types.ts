export type AttendanceActor = {
  userId?: string;
  roleType?: string;
};

export type AttendanceCounts = {
  total: number;
  present: number;
};

export type AttendanceSummary = {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  excusedDays: number;
  attendancePercentage: number;
  riskFlag: boolean;
};
