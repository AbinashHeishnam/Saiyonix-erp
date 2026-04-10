import { useState } from "react";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import ClassDetailsModal from "../../components/ClassDetailsModal";
import { useAsync } from "../../hooks/useAsync";
import { getStudentTimetable, TimetableGrouped } from "../../services/api/timetable";
import { DayView, MonthView, normalizeSlots, WeekView } from "./TimetableViews";
import api from "../../services/api/client";

export default function StudentTimetablePage() {
  const { data, error, loading } = useAsync<TimetableGrouped>(getStudentTimetable, []);
  const { data: exams } = useAsync(async () => {
    const res = await api.get("/exam/student/me");
    return res.data?.data ?? res.data ?? [];
  }, []);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [view, setView] = useState<"day" | "week" | "month">("day");

  const blockedDates = new Set<string>(
    (exams ?? [])
      .filter((item: any) => item.examType && item.examType !== "PERIODIC")
      .map((item: any) => new Date(item.date).toISOString().slice(0, 10))
  );

  const slots = normalizeSlots(
    data
      ? Object.values(data)
        .flat()
        .map((slot: any) => slot)
      : []
  );

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-8">
      <PageHeader title="My Timetable" subtitle="Weekly class schedule" />

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
        ) : slots.length ? (
          <>
            {view === "day" && (
              <DayView
                slots={slots}
                onSelect={(slot) => setSelectedSlot(slot.raw)}
                blockedDates={blockedDates}
              />
            )}
            {view === "week" && (
              <WeekView
                slots={slots}
                onSelect={(slot) => setSelectedSlot(slot.raw)}
                blockedDates={blockedDates}
              />
            )}
            {view === "month" && (
              <MonthView
                slots={slots}
                onSelect={(slot) => setSelectedSlot(slot.raw)}
                blockedDates={blockedDates}
              />
            )}
          </>
        ) : (
          <EmptyState title="No timetable available" description="Timetable is not set yet." />
        )}
      </Card>
      <ClassDetailsModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        variant="student"
      />
    </div>
  );
}
