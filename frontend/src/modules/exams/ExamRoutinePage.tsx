import { useMemo, useState } from "react";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type ExamRoutineItem = {
  examId: string;
  examTitle: string;
  examType: string;
  subject: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  shift?: string | null;
  roomNumber?: string | null;
};

type ViewKey = "day" | "week" | "month";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString();
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function withinRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

export default function ExamRoutinePage() {
  const [view, setView] = useState<ViewKey>("day");
  const [selected, setSelected] = useState<ExamRoutineItem | null>(null);

  const { data, loading, error } = useAsync(async () => {
    const res = await api.get("/exam/student/me");
    return res.data?.data ?? res.data ?? [];
  }, []);

  const items = useMemo(() => {
    const list = (data ?? []) as ExamRoutineItem[];
    const now = new Date();
    if (view === "day") {
      return list.filter((item) => isSameDay(new Date(item.date), now));
    }
    if (view === "week") {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      return list.filter((item) => withinRange(new Date(item.date), start, end));
    }
    const month = now.getMonth();
    const year = now.getFullYear();
    return list.filter((item) => {
      const d = new Date(item.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [data, view]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExamRoutineItem[]>();
    items.forEach((item) => {
      const key = formatDate(item.date);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [items]);

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-8">
      <PageHeader title="Exam Routine" subtitle="View upcoming exams and room details." />

      <div className="relative flex w-fit rounded-full bg-ink-50/80 p-1 shadow-inner ring-1 ring-ink-100/50">
        {["day", "week", "month"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key as ViewKey)}
            className={`relative z-10 flex w-24 items-center justify-center rounded-full py-2 text-[11px] font-bold tracking-wider transition-all duration-300 ${view === key ? "text-white" : "text-ink-500 hover:text-ink-800"
              }`}
          >
            {view === key && (
              <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 shadow-md shadow-sky-500/20" />
            )}
            {key.toUpperCase()}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <LoadingState label="Loading exam routine..." />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : grouped.length ? (
          <div className="flex flex-col gap-4">
            {grouped.map(([dateKey, entries]) => (
              <div key={dateKey} className="rounded-2xl border border-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-800">{dateKey}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <button
                      key={`${entry.examId}-${entry.subject}-${entry.startTime}`}
                      type="button"
                      onClick={() => setSelected(entry)}
                      className="text-left rounded-xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink-900">{entry.subject}</p>
                        <StatusBadge variant={entry.shift === "AFTERNOON" ? "info" : "success"} dot={false}>
                          {entry.shift ?? "MORNING"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {entry.examTitle} • {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                      </p>
                      {entry.roomNumber && (
                        <p className="mt-1 text-xs text-ink-500">Room {entry.roomNumber}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No exams scheduled" description="Exam routine will appear once published." />
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Exam Details"
        size="md"
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-ink-400">Subject</p>
              <p className="text-sm font-medium text-ink-800">{selected.subject}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Exam</p>
              <p className="text-sm font-medium text-ink-800">{selected.examTitle}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Date</p>
              <p className="text-sm font-medium text-ink-800">{formatDate(selected.date)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Time</p>
              <p className="text-sm font-medium text-ink-800">
                {formatTime(selected.startTime)} - {formatTime(selected.endTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Shift</p>
              <p className="text-sm font-medium text-ink-800">{selected.shift ?? "MORNING"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Room</p>
              <p className="text-sm font-medium text-ink-800">{selected.roomNumber ?? "—"}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
