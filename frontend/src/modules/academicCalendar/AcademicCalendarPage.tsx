import { useMemo, useState } from "react";

import AcademicYearFilter from "../../components/AcademicYearFilter";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import { useAsync } from "../../hooks/useAsync";
import {
  AcademicCalendarEvent,
  createAcademicCalendarEvent,
  createEmergencyHoliday,
  deleteAcademicCalendarEvent,
  listAcademicCalendarEvents,
  updateAcademicCalendarEvent,
} from "../../services/api/academicCalendar";

const EVENT_TYPES: AcademicCalendarEvent["eventType"][] = [
  "SESSION_START",
  "SESSION_END",
  "HOLIDAY",
  "TEMPORARY_HOLIDAY",
  "HALF_DAY",
  "EXAM_START",
  "EXAM_END",
  "IMPORTANT_NOTICE",
  "OTHER",
];

const EVENT_LABELS: Record<AcademicCalendarEvent["eventType"], string> = {
  SESSION_START: "Session Start",
  SESSION_END: "Session End",
  HOLIDAY: "Holiday",
  TEMPORARY_HOLIDAY: "Emergency Holiday",
  HALF_DAY: "Half Day",
  EXAM_START: "Exam Start",
  EXAM_END: "Exam End",
  IMPORTANT_NOTICE: "Important Notice",
  OTHER: "Other",
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildMonthMatrix(base: Date) {
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startOffset = (first.getDay() + 6) % 7; // Monday=0
  const cells: Array<{ date: Date | null; label: string }> = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: null, label: "" });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, label: String(day) });
  }
  return {
    cells,
    monthLabel: first.toLocaleString("en-IN", { month: "long", year: "numeric" }),
  };
}

function buildEventMap(events: AcademicCalendarEvent[]) {
  const map = new Map<string, AcademicCalendarEvent[]>();
  events.forEach((event) => {
    const start = parseDateOnly(event.startDate);
    const end = parseDateOnly(event.endDate);
    if (!start || !end) return;
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatDateInput(cursor);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(event);
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return map;
}

export default function AcademicCalendarPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [filterType, setFilterType] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicCalendarEvent | null>(null);
  const [autoTitle, setAutoTitle] = useState(true);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    eventType: "HOLIDAY" as AcademicCalendarEvent["eventType"],
    startDate: formatDateInput(new Date()),
    endDate: formatDateInput(new Date()),
    affectsAttendance: true,
    affectsClasses: true,
    notifyUsers: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const start = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
    const end = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0);
    return { start: formatDateInput(start), end: formatDateInput(end) };
  }, [activeMonth]);

  const { data, loading, refresh } = useAsync(async () => {
    if (!academicYearId) return { items: [] };
    return listAcademicCalendarEvents({
      academicYearId,
      from: range.start,
      to: range.end,
      eventType: filterType || undefined,
    });
  }, [academicYearId, range.start, range.end, filterType]);

  const events = (data?.items ?? []) as AcademicCalendarEvent[];
  const eventMap = useMemo(() => buildEventMap(events), [events]);
  const { cells, monthLabel } = useMemo(() => buildMonthMatrix(activeMonth), [activeMonth]);

  const openCreateModal = () => {
    setEditing(null);
    setAutoTitle(true);
    setFormState({
      title: "",
      description: "",
      eventType: "HOLIDAY",
      startDate: range.start,
      endDate: range.start,
      affectsAttendance: true,
      affectsClasses: true,
      notifyUsers: true,
    });
    setModalOpen(true);
  };

  const openCreateModalForDate = (date: Date) => {
    const dateValue = formatDateInput(date);
    setEditing(null);
    setAutoTitle(true);
    setFormState({
      title: EVENT_LABELS.HOLIDAY,
      description: "",
      eventType: "HOLIDAY",
      startDate: dateValue,
      endDate: dateValue,
      affectsAttendance: true,
      affectsClasses: true,
      notifyUsers: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (event: AcademicCalendarEvent) => {
    setEditing(event);
    setAutoTitle(false);
    setFormState({
      title: event.title,
      description: event.description ?? "",
      eventType: event.eventType,
      startDate: event.startDate.slice(0, 10),
      endDate: event.endDate.slice(0, 10),
      affectsAttendance: Boolean(event.affectsAttendance),
      affectsClasses: Boolean(event.affectsClasses),
      notifyUsers: Boolean(event.notifyUsers),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    if (!academicYearId) {
      setError("Select an academic year first.");
      return;
    }
    if (!formState.title.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      if (editing) {
        await updateAcademicCalendarEvent(editing.id, {
          ...formState,
        });
        setMessage("Event updated successfully.");
      } else {
        await createAcademicCalendarEvent({
          academicYearId,
          ...formState,
        });
        setMessage("Event created successfully.");
      }
      setModalOpen(false);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to save event.");
    }
  };

  const handleDelete = async (eventId: string) => {
    setError(null);
    setMessage(null);
    try {
      await deleteAcademicCalendarEvent(eventId);
      setMessage("Event deleted successfully.");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to delete event.");
    }
  };

  const handleEmergencyHoliday = async () => {
    setError(null);
    setMessage(null);
    if (!academicYearId) {
      setError("Select an academic year first.");
      return;
    }
    try {
      await createEmergencyHoliday({ academicYearId, notifyUsers: true });
      setMessage("Emergency holiday created for today.");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create emergency holiday.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Academic Calendar"
          subtitle="Manage session dates, holidays, exams, and important notices."
        />
        <div className="w-full max-w-sm">
          <AcademicYearFilter value={academicYearId} onChange={setAcademicYearId} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openCreateModal} variant="primary">
          Add Event
        </Button>
        <Button onClick={handleEmergencyHoliday} variant="secondary">
          Emergency Holiday Today
        </Button>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="min-w-[180px]">
          <option value="">All Types</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_LABELS[type]}
            </option>
          ))}
        </Select>
        {message && <span className="text-sm text-jade-600">{message}</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}
          >
            Previous
          </Button>
          <h2 className="text-lg font-semibold text-ink-800">{monthLabel}</h2>
          <Button
            variant="ghost"
            onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}
          >
            Next
          </Button>
        </div>
        {loading ? (
          <LoadingState label="Loading calendar" />
        ) : (
          <div className="mt-6 grid grid-cols-7 gap-3">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="text-xs font-semibold text-ink-500">
                {day}
              </div>
            ))}
            {cells.map((cell, idx) => {
              const key = cell.date ? formatDateInput(cell.date) : `empty-${idx}`;
              const dayEvents = cell.date ? eventMap.get(key) ?? [] : [];
              return (
                <div
                  key={key}
                  className={`min-h-[86px] rounded-xl border border-ink-100 p-2 text-xs ${
                    cell.date ? "bg-white hover:border-ink-300 hover:shadow-sm cursor-pointer" : "bg-ink-50"
                  }`}
                  onClick={() => {
                    if (cell.date) {
                      openCreateModalForDate(cell.date);
                    }
                  }}
                >
                  <div className="font-semibold text-ink-700">{cell.label}</div>
                  {dayEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="mt-1 truncate rounded bg-ink-100 px-2 py-0.5 text-[10px] text-ink-700">
                      {EVENT_LABELS[event.eventType]}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="mt-1 text-[10px] text-ink-500">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-ink-800">Event List</h3>
        {loading ? (
          <LoadingState label="Loading events" />
        ) : events.length === 0 ? (
          <div className="text-sm text-ink-500">No events for this range.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-xl border border-ink-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{event.title}</p>
                    <p className="text-xs text-ink-500">
                      {EVENT_LABELS[event.eventType]} • {event.startDate.slice(0, 10)}
                      {event.endDate && event.endDate !== event.startDate
                        ? ` → ${event.endDate.slice(0, 10)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEditModal(event)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(event.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {event.description && <p className="mt-2 text-xs text-ink-500">{event.description}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Event" : "Create Event"}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={formState.title}
            onChange={(e) => {
              setAutoTitle(false);
              setFormState((prev) => ({ ...prev, title: e.target.value }));
            }}
          />
          <Input
            label="Description"
            value={formState.description}
            onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Select
            label="Event Type"
            value={formState.eventType}
            onChange={(e) =>
              setFormState((prev) => {
                const nextType = e.target.value as AcademicCalendarEvent["eventType"];
                return {
                  ...prev,
                  eventType: nextType,
                  title: autoTitle ? EVENT_LABELS[nextType] : prev.title,
                };
              })
            }
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_LABELS[type]}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Start Date"
              type="date"
              value={formState.startDate}
              onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={formState.endDate}
              onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-ink-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formState.affectsAttendance}
                onChange={(e) => setFormState((prev) => ({ ...prev, affectsAttendance: e.target.checked }))}
              />
              Affects attendance
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formState.affectsClasses}
                onChange={(e) => setFormState((prev) => ({ ...prev, affectsClasses: e.target.checked }))}
              />
              Affects classes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formState.notifyUsers}
                onChange={(e) => setFormState((prev) => ({ ...prev, notifyUsers: e.target.checked }))}
              />
              Notify users
            </label>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            {editing && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const confirmed = window.confirm("Delete this event?");
                  if (!confirmed) return;
                  await handleDelete(editing.id);
                  setModalOpen(false);
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} variant="primary">
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
