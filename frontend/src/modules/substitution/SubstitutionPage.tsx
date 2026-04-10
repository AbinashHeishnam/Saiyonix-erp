import { useEffect, useMemo, useState } from "react";

import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Table from "../../components/Table";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import {
  listAdminSubstitutions,
  type AvailabilityItem,
  type SubstitutionItem,
  type ApprovedLeaveItem,
} from "../../services/api/substitutions";

type TeacherOption = { id: string; fullName: string };
type ClassOption = { id: string; className: string };

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatPeriodLabel(periodNumber?: number | null) {
  if (!periodNumber) return "—";
  const suffix =
    periodNumber === 1 ? "st" : periodNumber === 2 ? "nd" : periodNumber === 3 ? "rd" : "th";
  return `${periodNumber}${suffix}`;
}

export default function SubstitutionPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [academicYearId, setAcademicYearId] = useState("");
  const [date, setDate] = useState(todayIso);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [expandedLeaveId, setExpandedLeaveId] = useState<string | null>(null);
  const [assigningSlotId, setAssigningSlotId] = useState<string | null>(null);
  const [slotSelections, setSlotSelections] = useState<Record<string, string>>({});

  const handleDateChange = (value: string) => {
    setDate(value);
    setPage(1);
    setExpandedLeaveId(null);
  };

  const handleTeacherChange = (value: string) => {
    setTeacherId(value);
    setPage(1);
  };

  const handleClassChange = (value: string) => {
    setClassId(value);
    setPage(1);
  };

  const { data: teacherOptions } = useAsync(async () => {
    const res = await api.get("/teachers", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data;
    const items = Array.isArray(payload) ? payload : payload?.data ?? [];
    return (items as TeacherOption[]).filter((t) => t?.id && t?.fullName);
  }, []);

  const { data: classOptions } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    const payload = res.data?.data ?? res.data;
    const items = Array.isArray(payload) ? payload : payload?.data ?? [];
    return (items as ClassOption[]).filter((c) => c?.id && c?.className);
  }, [academicYearId]);

  const { data, loading, error, refresh } = useAsync(async () => {
    return listAdminSubstitutions({
      date,
      teacherId: teacherId || undefined,
      classId: classId || undefined,
      academicYearId: academicYearId || undefined,
      includeAvailability: true,
      page,
      limit,
    });
  }, [date, teacherId, classId, academicYearId, page, limit]);

  const substitutions = useMemo(
    () => ((data?.items ?? []) as SubstitutionItem[]),
    [data]
  );
  const substitutionBySlot = useMemo(() => {
    const map = new Map<string, SubstitutionItem>();
    for (const item of substitutions) {
      const slotId = item.timetableSlot?.id;
      if (slotId) {
        map.set(slotId, item);
      }
    }
    return map;
  }, [substitutions]);

  const availability = useMemo(
    () => ((data?.availability ?? []) as AvailabilityItem[]),
    [data]
  );
  const approvedLeaves = useMemo(
    () => ((data?.approvedLeaves ?? []) as ApprovedLeaveItem[]),
    [data]
  );
  const meta = data?.meta as { page?: number; totalPages?: number; total?: number } | null;

  const getSelectedSubstitute = (slotId: string) =>
    slotSelections[slotId] ?? substitutionBySlot.get(slotId)?.substituteTeacher?.id ?? "";

  const handleAssignSubstitute = async (slotId: string) => {
    const substituteTeacherId = getSelectedSubstitute(slotId);
    if (!substituteTeacherId) {
      return;
    }
    setAssigningSlotId(slotId);
    try {
      await safeApiCall(
        () =>
          api.post("/admin/timetable/substitute", {
            timetableSlotId: slotId,
            substitutionDate: date,
            substituteTeacherId,
            reason: "Emergency substitution",
          }),
        { loading: "Assigning substitute...", success: "Substitute assigned" }
      );
      await refresh();
    } finally {
      setAssigningSlotId(null);
    }
  };

  useEffect(() => {
    if (meta?.totalPages && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta?.totalPages, page]);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fade-in">
      <PageHeader
        title="Teacher Substitution"
        subtitle="Auto-assigned substitutions based on timetable, availability, and workload."
      />
      <AcademicYearFilter
        value={academicYearId}
        onChange={(value) => {
          setAcademicYearId(value);
          setClassId("");
        }}
        syncQueryKey="academicYearId"
      />

      <Card
        title="Today's Substitutions"
        subtitle="Live assignments for the selected date."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={date}
              onChange={(event) => handleDateChange(event.target.value)}
              className="text-sm"
            />
            <button
              onClick={() => refresh()}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        }
      >
        {loading && <p className="text-sm text-slate-500">Loading substitutions...</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!loading && !substitutions.length && (
          <p className="text-sm text-slate-500">No substitutions for this date.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {substitutions.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {formatPeriodLabel(item.period?.periodNumber)} Period
                </span>
                <span
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase text-amber-700"
                  title="Assigned due to leave"
                >
                  Substitute
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Class:</span>{" "}
                  {item.class?.className ?? "—"}-{item.section?.sectionName ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Subject:</span>{" "}
                  {item.timetableSlot?.classSubject?.subject?.name ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Absent:</span>{" "}
                  {item.absentTeacher?.fullName ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Substitute:</span>{" "}
                  {item.substituteTeacher?.fullName ?? "UNASSIGNED"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Approved Leaves" subtitle="Teachers approved for leave on the selected date.">
        {!approvedLeaves.length && (
          <p className="text-sm text-slate-500">No approved leaves for this date.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {approvedLeaves.map((leave) => (
            <div
              key={leave.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Approved Leave
                </span>
                {leave.leaveType && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase text-emerald-700">
                    {leave.leaveType}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Teacher:</span>{" "}
                  {leave.teacher?.fullName ?? "—"}
                  {leave.teacher?.employeeId ? ` (${leave.teacher.employeeId})` : ""}
                </p>
                <p>
                  <span className="font-semibold">Dates:</span>{" "}
                  {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                </p>
                <p>
                  <span className="font-semibold">Reason:</span> {leave.reason}
                </p>
              </div>
              <div className="mt-3">
                <button
                  onClick={() =>
                    setExpandedLeaveId((prev) => (prev === leave.id ? null : leave.id))
                  }
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  {expandedLeaveId === leave.id ? "Hide Periods" : "View Periods"}
                </button>
              </div>
              {expandedLeaveId === leave.id && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700">
                  {leave.slots?.length ? (
                    <div className="space-y-2">
                      {leave.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 shadow-sm"
                        >
                          <span className="text-xs font-semibold uppercase text-slate-400">
                            {formatPeriodLabel(slot.period?.periodNumber)} Period
                          </span>
                          <span>
                            <span className="font-semibold">Class:</span>{" "}
                            {slot.class?.className ?? "—"}-{slot.section?.sectionName ?? "—"}
                          </span>
                          <span>
                            <span className="font-semibold">Subject:</span>{" "}
                            {slot.subject?.name ?? "—"}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Select
                              value={getSelectedSubstitute(slot.id)}
                              onChange={(event) =>
                                setSlotSelections((prev) => ({
                                  ...prev,
                                  [slot.id]: event.target.value,
                                }))
                              }
                              className="min-w-[200px]"
                            >
                              <option value="">Select substitute</option>
                              {(teacherOptions ?? [])
                                .filter((t) => t.id !== leave.teacherId)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.fullName}
                                  </option>
                                ))}
                            </Select>
                            <button
                              onClick={() => handleAssignSubstitute(slot.id)}
                              disabled={
                                assigningSlotId === slot.id || !getSelectedSubstitute(slot.id)
                              }
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                            >
                              {assigningSlotId === slot.id ? "Assigning..." : "Assign"}
                            </button>
                            {substitutionBySlot.get(slot.id)?.substituteTeacher?.fullName && (
                              <span className="text-xs font-semibold text-emerald-700">
                                Assigned to {substitutionBySlot.get(slot.id)?.substituteTeacher?.fullName}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No periods assigned for this date.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Admin View" subtitle="Filter and review substitution history.">
        <div className="flex flex-wrap items-end gap-4 pb-4">
          <div className="min-w-[180px]">
            <label className="text-xs font-semibold uppercase text-slate-400">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(event) => handleDateChange(event.target.value)}
              className="mt-1"
            />
          </div>
          <div className="min-w-[220px]">
            <label className="text-xs font-semibold uppercase text-slate-400">Teacher</label>
            <Select
              value={teacherId}
              onChange={(event) => handleTeacherChange(event.target.value)}
              className="mt-1"
            >
              <option value="">All Teachers</option>
              {(teacherOptions ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-semibold uppercase text-slate-400">Class</label>
            <Select
              value={classId}
              onChange={(event) => handleClassChange(event.target.value)}
              className="mt-1"
            >
              <option value="">All Classes</option>
              {(classOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-semibold uppercase text-slate-400">Page Size</label>
            <Select
              value={String(limit)}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="mt-1"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Table columns={["Date", "Period", "Absent Teacher", "Substitute", "Class/Section", "Subject"]}>
          {substitutions.map((item) => (
            <tr key={item.id} className="bg-white/90 shadow-sm">
              <td className="px-3 py-3 text-sm font-medium text-slate-600">{formatDate(item.date)}</td>
              <td className="px-3 py-3 text-sm text-slate-700">
                {formatPeriodLabel(item.period?.periodNumber)}
                <span
                  className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700"
                  title="Assigned due to leave"
                >
                  Substitute
                </span>
              </td>
              <td className="px-3 py-3 text-sm text-slate-700">{item.absentTeacher?.fullName ?? "—"}</td>
              <td className="px-3 py-3 text-sm text-slate-700">
                {item.substituteTeacher?.fullName ?? "UNASSIGNED"}
              </td>
              <td className="px-3 py-3 text-sm text-slate-700">
                {item.class?.className ?? "—"}-{item.section?.sectionName ?? "—"}
              </td>
              <td className="px-3 py-3 text-sm text-slate-700">
                {item.timetableSlot?.classSubject?.subject?.name ?? "—"}
              </td>
            </tr>
          ))}
        </Table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {meta?.total ?? substitutions.length} total
            {meta?.totalPages ? ` • Page ${meta.page ?? page} of ${meta.totalPages}` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => {
                const totalPages = meta?.totalPages ?? page + 1;
                setPage((prev) => Math.min(totalPages, prev + 1));
              }}
              disabled={
                meta?.totalPages
                  ? page >= meta.totalPages || substitutions.length < limit
                  : substitutions.length < limit
              }
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      <Card title="Live Availability" subtitle="Teachers free per period for the selected date.">
        {!availability.length && (
          <p className="text-sm text-slate-500">No availability data available.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availability.map((period) => (
            <div
              key={period.periodId}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Period {period.periodNumber}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {period.freeTeachers.length} free
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {period.freeTeachers.length === 0 && (
                  <span className="text-xs text-slate-400">No free teachers</span>
                )}
                {period.freeTeachers.map((teacher) => (
                  <span
                    key={teacher.id}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    title="Available to substitute"
                  >
                    {teacher.fullName ?? "Teacher"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
