import { useEffect } from "react";
import { formatTime } from "../utils/time";

type SlotLike = any;

function getSubject(slot: SlotLike) {
  return (
    slot?.classSubject?.subject?.name ??
    slot?.subject?.name ??
    slot?.subjectName ??
    "Subject"
  );
}

function getTeacher(slot: SlotLike) {
  return slot?.teacher?.fullName ?? slot?.teacherName ?? "Teacher";
}

function getClassSection(slot: SlotLike) {
  const className = slot?.section?.class?.className ?? slot?.className ?? "";
  const sectionName = slot?.section?.sectionName ?? slot?.sectionName ?? "";
  return `${className}${sectionName ? ` - ${sectionName}` : ""}`.trim();
}

function getTimeRange(slot: SlotLike) {
  const start = slot?.period?.startTime;
  const end = slot?.period?.endTime;
  if (!start && !end) return "—";
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export default function ClassDetailsModal({
  slot,
  onClose,
  variant = "student",
}: {
  slot: SlotLike | null;
  onClose: () => void;
  variant?: "student" | "parent" | "teacher";
}) {
  useEffect(() => {
    if (!slot) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [slot]);

  if (!slot) return null;

  const subject = getSubject(slot);
  const teacher = getTeacher(slot);
  const classSection = getClassSection(slot);
  const timeRange = getTimeRange(slot);
  const roomNo = slot?.roomNo ?? slot?.room ?? null;
  const remarks = slot?.remarks ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6 animate-fade-in"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-glow animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Class Details</h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm font-semibold text-ink-500 hover:bg-ink-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Subject</p>
            <p className="text-lg font-semibold text-ink-900">{subject}</p>
          </div>

          {variant === "teacher" && classSection && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Class</p>
              <p className="text-base font-semibold text-ink-900">{classSection}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Time</p>
            <p className="text-sm text-ink-700">{timeRange}</p>
          </div>

          {variant !== "teacher" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Faculty</p>
              <p className="text-sm text-ink-700">{teacher}</p>
            </div>
          )}

          {variant !== "teacher" && classSection && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Class & Section</p>
              <p className="text-sm text-ink-700">{classSection}</p>
            </div>
          )}

          {roomNo && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Room No</p>
              <p className="text-sm text-ink-700">{roomNo}</p>
            </div>
          )}

          {remarks && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Remarks</p>
              <p className="text-sm text-ink-700">{remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
