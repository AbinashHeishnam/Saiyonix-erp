import { useState } from "react";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import ClassDetailsModal from "../../components/ClassDetailsModal";
import { useAsync } from "../../hooks/useAsync";
import { getParentTimetable } from "../../services/api/timetable";
import { DayView, MonthView, normalizeSlots, WeekView } from "./TimetableViews";
import api from "../../services/api/client";

export default function ParentTimetablePage() {
  const { data, error, loading } = useAsync<any>(getParentTimetable, []);
  const { data: exams } = useAsync(async () => {
    const res = await api.get("/exam/student/me");
    return res.data?.data ?? res.data ?? [];
  }, []);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [view, setView] = useState<"day" | "week" | "month">("day");

  const rows = Array.isArray(data) ? data : [];
  const blockedDates = new Set<string>(
    (exams ?? [])
      .filter((item: any) => item.examType && item.examType !== "PERIODIC")
      .map((item: any) => new Date(item.date).toISOString().slice(0, 10))
  );

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-8">
      <PageHeader title="Child Timetable" subtitle="Weekly class schedule" />

      <div className="relative flex w-fit rounded-full bg-ink-50/80 p-1 shadow-inner ring-1 ring-ink-100/50">
        {["day", "week", "month"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key as "day" | "week" | "month")}
            className={`relative z-10 flex w-24 items-center justify-center rounded-full py-2 text-[11px] font-bold tracking-wider transition-all duration-300 ${view === key ? "text-white" : "text-ink-500 hover:text-ink-800"
              }`}
          >
            {view === key && (
              <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-jade-500 to-emerald-500 shadow-md shadow-emerald-500/20" />
            )}
            {key.toUpperCase()}
          </button>
        ))}
      </div>
      <Card>
        {loading ? (
          <LoadingState label="Loading timetable..." />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : rows.length ? (
          <div className="flex flex-col gap-4">
            {rows.map((entry: any) => (
              <div key={entry.studentId} className="rounded-xl border border-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-800">
                  {entry.studentName ?? "Student"}
                </p>
                {entry.slots?.length ? (
                  <div className="mt-3">
                    {view === "day" && (
                      <DayView
                        slots={normalizeSlots(entry.slots)}
                        onSelect={(slot) => setSelectedSlot(slot.raw)}
                        blockedDates={blockedDates}
                      />
                    )}
                    {view === "week" && (
                      <WeekView
                        slots={normalizeSlots(entry.slots)}
                        onSelect={(slot) => setSelectedSlot(slot.raw)}
                        blockedDates={blockedDates}
                      />
                    )}
                    {view === "month" && (
                      <MonthView
                        slots={normalizeSlots(entry.slots)}
                        onSelect={(slot) => setSelectedSlot(slot.raw)}
                        blockedDates={blockedDates}
                      />
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-500">No timetable available.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No timetable available" description="No child timetable found yet." />
        )}
      </Card>
      <ClassDetailsModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        variant="parent"
      />
    </div>
  );
}
