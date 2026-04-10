import { useMemo, useRef } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import { useAsync } from "../../../hooks/useAsync";
import { getStudentPromotionStatus } from "../../../services/api/promotion";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

function normalizeList<T>(payload: any): T | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  return payload;
}

function resolveStatusLabel(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "PROMOTED":
      return "Promoted";
    case "ELIGIBLE":
      return "Eligible for Promotion";
    case "NOT_PROMOTED":
    case "FAILED":
      return "Not Promoted";
    case "UNDER_CONSIDERATION":
      return "Under Consideration";
    default:
      return "—";
  }
}

function resolveStatusMessage(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "You have successfully completed your class";
    case "PROMOTED":
      return "You have been promoted to next class";
    case "ELIGIBLE":
      return "You are eligible for promotion";
    case "NOT_PROMOTED":
    case "FAILED":
      return "You have not been promoted";
    case "UNDER_CONSIDERATION":
      return "Awaiting teacher decision for promotion";
    default:
      return "—";
  }
}

function formatClassName(name?: string | null) {
  if (!name) return "—";
  if (/^\d+$/.test(name)) return `Class ${name}`;
  return name;
}

function toSnakeCase(value?: string | null) {
  if (!value) return "—";
  return value
    .trim()
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

type PromotionViewPayload = {
  status?: string | null;
  student?: { fullName?: string | null } | null;
  studentName?: string | null;
  promotedClass?: { className?: string | null } | null;
  promotedSection?: { sectionName?: string | null } | null;
  currentClass?: { className?: string | null } | null;
  currentClassName?: string | null;
  currentSection?: { sectionName?: string | null } | null;
  currentSectionName?: string | null;
  percentage?: number | null;
  rank?: number | null;
  attendancePercent?: number | null;
  failedSubjects?: number | null;
  passedSubjects?: number | null;
  totalSubjects?: number | null;
  minAttendancePercent?: number | null;
  minAttendance?: number | null;
  requiredAttendance?: number | null;
  allowedFailedSubjects?: number | null;
  maxFailedSubjects?: number | null;
  minSubjectPassCount?: number | null;
  isFinalClass?: boolean | null;
};

export default function StudentPromotionStatus() {
  const { data, loading, error } = useAsync<PromotionViewPayload | null>(async () => {
    const res = await getStudentPromotionStatus();
    return normalizeList(res);
  }, []);

  const info = useMemo(() => data ?? null, [data]);
  const loggedRef = useRef(false);
  if (!loggedRef.current && info && import.meta.env.MODE !== "production") {
    console.log({
      status: info.status,
      nextClass: info.promotedClass?.className ?? null,
      nextSection: info.promotedSection?.sectionName ?? null,
      enrollmentExists: Boolean(info.promotedClass && info.promotedSection),
    });
    loggedRef.current = true;
  }
  const isFinalClass = info?.isFinalClass === true;
  const hasNext = Boolean(info?.promotedClass && info?.promotedSection);
  const effectiveStatus = isFinalClass ? "COMPLETED" : info?.status ?? null;
  const nextClassLabel =
    effectiveStatus === "UNDER_CONSIDERATION"
      ? "Not assigned yet"
      : isFinalClass
        ? "—"
        : hasNext
          ? `${formatClassName(info?.promotedClass?.className ?? "—")} ${toSnakeCase(info?.promotedSection?.sectionName ?? "—")}`
          : "Not assigned yet";

  const minAttendance =
    info?.minAttendancePercent ?? info?.minAttendance ?? info?.requiredAttendance ?? null;
  const allowedFailed =
    info?.allowedFailedSubjects ?? info?.maxFailedSubjects ?? info?.minSubjectPassCount ?? null;
  const reasons: string[] = [];
  if (
    effectiveStatus === "UNDER_CONSIDERATION" &&
    typeof info?.attendancePercent === "number" &&
    typeof minAttendance === "number" &&
    info.attendancePercent < minAttendance
  ) {
    reasons.push("Low attendance");
  }
  if (
    effectiveStatus === "UNDER_CONSIDERATION" &&
    typeof info?.failedSubjects === "number" &&
    typeof allowedFailed === "number" &&
    info.failedSubjects > allowedFailed
  ) {
    reasons.push("Too many failed subjects");
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Promotion Status" subtitle="Track your promotion outcome." />

      <Card title="Promotion Summary" subtitle="Your latest promotion result.">
        {loading ? (
          <Loader label="Fetching promotion status..." />
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : !info || !info.status ? (
          <EmptyState title="No promotion data" description="Promotion data will appear once published." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Student</p>
                <p className="text-lg font-semibold text-ink-800">
                  {info.student?.fullName ?? info.studentName ?? "—"}
                </p>
              </div>
              <StatusBadge status={effectiveStatus ?? info.status}>
                {resolveStatusLabel(effectiveStatus ?? undefined)}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Current Class</p>
                <p className="text-base font-semibold text-ink-800">
                  {formatClassName(info.currentClass?.className ?? info.currentClassName)}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Next Class</p>
                <p className="text-base font-semibold text-ink-800">
                  {nextClassLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Current Section</p>
                <p className="text-base font-semibold text-ink-800">
                  {toSnakeCase(info.currentSection?.sectionName ?? info.currentSectionName)}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Next Section</p>
                <p className="text-base font-semibold text-ink-800">
                  {effectiveStatus === "UNDER_CONSIDERATION"
                    ? "Not assigned yet"
                    : isFinalClass
                      ? "—"
                      : hasNext
                        ? toSnakeCase(info?.promotedSection?.sectionName ?? "—")
                        : "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Rank</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.rank ?? "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Percentage</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.percentage != null ? `${info.percentage}%` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Attendance</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.attendancePercent != null ? `${info.attendancePercent}%` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Failed Subjects</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.failedSubjects ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Passed Subjects</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.passedSubjects ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Total Subjects</p>
                <p className="text-base font-semibold text-ink-800">
                  {info.totalSubjects ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs text-ink-500">Message</p>
                <p className="text-sm font-medium text-ink-700">
                  {resolveStatusMessage(effectiveStatus ?? undefined)}
                </p>
              </div>
              {effectiveStatus === "UNDER_CONSIDERATION" && reasons.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">Reason</p>
                  <p className="text-sm font-semibold text-amber-800">
                    {reasons.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
