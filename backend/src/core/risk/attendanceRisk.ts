const DEFAULT_ATTENDANCE_THRESHOLDS = [85, 80, 75] as const;

type AttendanceThreshold = (typeof DEFAULT_ATTENDANCE_THRESHOLDS)[number];

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateAttendancePercentage(totalDays: number, presentDays: number) {
  if (totalDays <= 0) {
    return 100;
  }

  const safePresent = Math.max(0, Math.min(presentDays, totalDays));
  return roundToTwoDecimals((safePresent / totalDays) * 100);
}

export function checkAttendanceThresholds(percentage: number): {
  crossedLevel: AttendanceThreshold | null;
} {
  for (const threshold of [...DEFAULT_ATTENDANCE_THRESHOLDS].sort((a, b) => a - b)) {
    if (percentage < threshold) {
      return { crossedLevel: threshold };
    }
  }

  return { crossedLevel: null };
}

export { DEFAULT_ATTENDANCE_THRESHOLDS };
export type { AttendanceThreshold };
