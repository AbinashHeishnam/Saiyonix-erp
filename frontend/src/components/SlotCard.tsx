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

export default function SlotCard({
  slot,
  onClick,
  showClass,
}: {
  slot: SlotLike;
  onClick: () => void;
  showClass?: boolean;
}) {
  const subject = getSubject(slot);
  const teacher = getTeacher(slot);
  const classSection = getClassSection(slot);
  const period = slot?.period?.periodNumber ?? slot?.periodNumber;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 text-left text-xs transition-all duration-300 hover:-translate-y-1 hover:border-jade-300 hover:shadow-xl hover:shadow-jade-100"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-jade-50/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-jade-50 px-2 py-1 text-[10px] font-semibold tracking-wide text-jade-700 ring-1 ring-inset ring-jade-600/20">
            Period {period}
          </span>
        </div>
        <p className="text-base font-bold text-ink-900 transition-colors group-hover:text-jade-900">
          {subject}
        </p>

        {showClass && classSection && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink-600">
            <svg className="h-3.5 w-3.5 text-ink-400 group-hover:text-jade-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {classSection}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
          <svg className="h-3.5 w-3.5 text-ink-400 group-hover:text-jade-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {teacher}
        </div>
      </div>
    </button>
  );
}
