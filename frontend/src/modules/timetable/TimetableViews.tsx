import { useMemo } from "react";
import { formatTime } from "../../utils/time";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const subjectColors: Record<string, string> = {
  English: "from-blue-500 to-blue-400",
  Math: "from-purple-500 to-purple-400",
  Mathematics: "from-purple-500 to-purple-400",
  EVS: "from-green-500 to-green-400",
  "Environmental Studies": "from-green-500 to-green-400",
  Hindi: "from-amber-500 to-amber-400",
  Science: "from-cyan-500 to-cyan-400",
  Social: "from-rose-500 to-rose-400",
};

const premiumGradients = [
  "from-violet-500 to-fuchsia-500",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
  "from-amber-500 to-orange-400",
  "from-teal-500 to-cyan-500",
  "from-sky-500 to-indigo-500",
  "from-pink-500 to-rose-400",
  "from-purple-500 to-indigo-400"
];

function getGradient(subject: string) {
  if (subjectColors[subject]) return subjectColors[subject];

  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % premiumGradients.length;
  return premiumGradients[index];
}

export type TimetableSlotLite = {
  dayOfWeek: number;
  subjectName: string;
  teacherName?: string | null;
  className?: string | null;
  sectionName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  raw: any;
};

export function normalizeSlots(slots: any[]): TimetableSlotLite[] {
  return slots.map((slot) => ({
    dayOfWeek: slot?.dayOfWeek ?? 1,
    subjectName:
      slot?.classSubject?.subject?.name ??
      slot?.subject?.name ??
      slot?.subjectName ??
      "Subject",
    teacherName: slot?.teacher?.fullName ?? slot?.teacherName ?? null,
    className: slot?.section?.class?.className ?? slot?.className ?? null,
    sectionName: slot?.section?.sectionName ?? slot?.sectionName ?? null,
    startTime: slot?.period?.startTime ?? slot?.startTime ?? null,
    endTime: slot?.period?.endTime ?? slot?.endTime ?? null,
    raw: slot,
  }));
}

function SlotCard({
  slot,
  onClick,
  showClass,
}: {
  slot: TimetableSlotLite;
  onClick: () => void;
  showClass?: boolean;
}) {
  const gradient = getGradient(slot.subjectName);
  const time = `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
  const classSection = `${slot.className ?? ""}${slot.sectionName ? ` - ${slot.sectionName}` : ""}`.trim();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-left text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/20`}
    >
      <div className="absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/10" />
      <div className="relative z-10">
        <p className="mb-3 text-[11px] font-semibold tracking-wider text-white/90 uppercase">{time}</p>
        <p className="text-lg font-bold drop-shadow-sm">{slot.subjectName}</p>

        {showClass && classSection && (
          <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white/95">
            <svg className="h-4 w-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {classSection}
          </div>
        )}
        {!showClass && slot.teacherName && (
          <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white/90">
            <svg className="h-4 w-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {slot.teacherName}
          </div>
        )}
      </div>
    </button>
  );
}

export function DayView({
  slots,
  onSelect,
  showClass,
  blockedDates,
}: {
  slots: TimetableSlotLite[];
  onSelect: (slot: TimetableSlotLite) => void;
  showClass?: boolean;
  blockedDates?: Set<string>;
}) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (blockedDates?.has(todayKey)) {
    return <p className="text-sm text-ink-500">Exam day. Regular classes are hidden.</p>;
  }
  const todayIndex = ((new Date().getDay() + 6) % 7) + 1;
  const todaysSlots = slots
    .filter((slot) => slot.dayOfWeek === todayIndex)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  return (
    <div className="flex flex-col gap-4">
      {todaysSlots.length === 0 ? (
        <p className="text-sm text-ink-500">No classes scheduled for today.</p>
      ) : (
        <div className="relative border-l-2 border-ink-100 pl-6 ml-4 mt-2 space-y-6">
          {todaysSlots.map((slot, idx) => (
            <div key={`day-${idx}`} className="relative flex flex-col items-start gap-2">
              <div className="absolute -left-[33px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-ink-200 ring-4 ring-white">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <div className="w-full">
                <SlotCard slot={slot} onClick={() => onSelect(slot)} showClass={showClass} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeekView({
  slots,
  onSelect,
  showClass,
  blockedDates,
}: {
  slots: TimetableSlotLite[];
  onSelect: (slot: TimetableSlotLite) => void;
  showClass?: boolean;
  blockedDates?: Set<string>;
}) {
  const today = new Date();
  const monday = new Date(today);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const grouped = useMemo(() => {
    const map: Record<string, TimetableSlotLite[]> = {};
    DAYS.forEach((day) => {
      map[day] = [];
    });
    slots.forEach((slot) => {
      const day = DAYS[slot.dayOfWeek - 1] ?? "MONDAY";
      map[day].push(slot);
    });
    Object.values(map).forEach((items) =>
      items.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    );
    return map;
  }, [slots]);

  return (
    <div className="grid gap-4 lg:grid-cols-6">
      {DAYS.slice(0, 6).map((dayName, idx) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + idx);
        const dateKey = date.toISOString().slice(0, 10);
        const isBlocked = blockedDates?.has(dateKey);

        return (
        <div key={dayName} className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-ink-50/30 p-3 pt-4">
          <p className="text-xs font-bold tracking-wide text-ink-500">{DAY_SHORT[idx]}</p>
          <div className="flex flex-col gap-3">
            {isBlocked ? (
              <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-ink-200">
                <p className="text-xs font-medium text-ink-500">Exam Day</p>
              </div>
            ) : grouped[dayName]?.length ? (
              grouped[dayName].map((slot, slotIdx) => (
                <SlotCard
                  key={`${dayName}-${slotIdx}`}
                  slot={slot}
                  onClick={() => onSelect(slot)}
                  showClass={showClass}
                />
              ))
            ) : (
              <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-ink-200">
                <p className="text-xs font-medium text-ink-400">No classes</p>
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

export function MonthView({
  slots,
  onSelect,
  showClass: _showClass,
  blockedDates,
}: {
  slots: TimetableSlotLite[];
  onSelect: (slot: TimetableSlotLite) => void;
  showClass?: boolean;
  blockedDates?: Set<string>;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const slotsByDow = useMemo(() => {
    const map: Record<number, TimetableSlotLite[]> = {};
    slots.forEach((slot) => {
      map[slot.dayOfWeek] = map[slot.dayOfWeek] ?? [];
      map[slot.dayOfWeek].push(slot);
    });
    return map;
  }, [slots]);

  const cells: Array<{ date: number | null; dow: number }> = [];
  for (let i = 0; i < startDay; i += 1) {
    cells.push({ date: null, dow: i });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = new Date(year, month, day).getDay();
    cells.push({ date: day, dow });
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="pb-2 text-center text-xs font-bold tracking-wider text-ink-500">
          {d}
        </div>
      ))}
      {cells.map((cell, idx) => {
        const dowNumber = cell.dow === 0 ? 7 : cell.dow;
        const daySlots = cell.date ? slotsByDow[dowNumber] ?? [] : [];
        const isToday = cell.date === today.getDate();
        const dateKey = cell.date
          ? new Date(year, month, cell.date).toISOString().slice(0, 10)
          : null;
        const isBlocked = dateKey ? blockedDates?.has(dateKey) : false;
        return (
          <div
            key={`cell-${idx}`}
            className={`flex h-24 flex-col rounded-2xl border border-ink-100 p-2 transition-colors ${isToday ? "border-sky-200 bg-sky-50 shadow-inner" : "bg-white hover:bg-ink-50/50"
              }`}
          >
            <div className="flex items-start justify-between">
              {cell.date ? (
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-sky-500 text-white shadow-md shadow-sky-500/30" : "text-ink-700"}`}>
                  {cell.date}
                </span>
              ) : (
                <span />
              )}
            </div>
            {isBlocked && cell.date && (
              <div className="mt-auto pl-1">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="text-[10px] font-bold text-ink-600">Exam Day</span>
                </div>
              </div>
            )}
            {!isBlocked && daySlots.length > 0 && cell.date && (
              <div className="mt-auto pl-1">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-sky-600" : "bg-sky-400"}`} />
                  <span className="text-[10px] font-bold text-ink-600">{daySlots.length} Classes</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(daySlots[0])}
                  className="w-full rounded-md bg-ink-100/50 py-1 text-[10px] font-bold tracking-wide text-ink-700 transition hover:bg-ink-200"
                >
                  VIEW
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
