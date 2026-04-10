import { useState } from "react";

import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import SlotCard from "../../components/SlotCard";
import ClassDetailsModal from "../../components/ClassDetailsModal";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { getTeacherTimetable, getTeacherToday, TimetableGrouped } from "../../services/api/timetable";

export default function TeacherTimetablePage() {
  const { data: profile } = useAsync(async () => {
    const res = await api.get("/teacher/profile");
    return res.data?.data ?? res.data;
  }, []);

  const teacherId = (profile?.teacher?.id ?? profile?.id) as string | undefined;

  const { data: weekly } = useAsync(
    async () => (teacherId ? await getTeacherTimetable(teacherId) : ({} as TimetableGrouped)),
    [teacherId]
  );
  const { data: today } = useAsync(getTeacherToday, []);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" })
    .format(new Date())
    .toUpperCase();
  const rawWeeklyToday = weekly?.[todayName as keyof TimetableGrouped] as any;
  const weeklyTodaySlots = Array.isArray(rawWeeklyToday)
    ? rawWeeklyToday
    : Array.isArray(rawWeeklyToday?.slots)
      ? rawWeeklyToday.slots
      : [];
  const todaySlots = (today?.slots?.length ? today.slots : weeklyTodaySlots) ?? [];
  const hasWeeklyTimetable = Boolean(weekly && Object.keys(weekly).length);

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="My Timetable" subtitle="Weekly schedule and today’s classes" />

      <Card title="Today">
        {today?.holiday ? (
          <p className="text-sm text-ink-600">No classes today ({today.holiday}).</p>
        ) : todaySlots?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {todaySlots.map((slot: any, idx: number) => (
              <SlotCard
                key={slot.id ?? `today-${idx}`}
                slot={slot}
                onClick={() => setSelectedSlot(slot)}
                showClass
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            {hasWeeklyTimetable
              ? "No classes scheduled for today."
              : "No timetable assigned for the active academic year."}
          </p>
        )}
      </Card>

      <Card title="Weekly Timetable">
        {weekly && Object.keys(weekly).length ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Object.entries(weekly).map(([day, slots]) => {
              const daySlots = Array.isArray(slots)
                ? slots
                : Array.isArray((slots as any)?.slots)
                  ? (slots as any).slots
                  : [];
              return (
              <div key={day} className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-ink-50/30 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 rounded-full bg-jade-500" />
                  <p className="text-sm font-bold tracking-wide text-ink-700 uppercase">{day}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {daySlots.map((slot: any, idx: number) => (
                    <SlotCard
                      key={`${day}-${idx}`}
                      slot={slot}
                      onClick={() => setSelectedSlot(slot)}
                      showClass
                    />
                  ))}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            No timetable assigned for the active academic year.
          </p>
        )}
      </Card>
      <ClassDetailsModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        variant="teacher"
      />
    </div>
  );
}
