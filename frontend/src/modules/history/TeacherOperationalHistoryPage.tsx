import { useMemo, useState } from "react";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { getTeacherTimetable } from "../../services/api/timetable";
import { getActiveAcademicYear, getAcademicYearTransitionMeta } from "../../services/api/metadata";

type TeacherAssignment = {
  id: string;
  sectionId?: string | null;
  academicYearId?: string;
  classSubject?: {
    class?: { className?: string | null } | null;
    subject?: { name?: string | null } | null;
  } | null;
  section?: { sectionName?: string | null } | null;
};

export default function TeacherOperationalHistoryPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const { data: activeYear } = useAsync(getActiveAcademicYear, []);
  const { data: transitionMeta } = useAsync(getAcademicYearTransitionMeta, []);
  const resolvedActiveYearId = activeYear?.id ?? transitionMeta?.toAcademicYear?.id ?? "";
  const effectiveAcademicYearId = academicYearId || resolvedActiveYearId;

  const { data: profile } = useAsync(async () => {
    const res = await api.get("/teacher/profile");
    return res.data?.data ?? res.data;
  }, []);

  const teacherId = (profile?.teacher?.id ?? profile?.id) as string | undefined;

  const {
    data: assignments,
    loading: loadingAssignments,
    error: assignmentsError,
  } = useAsync(async () => {
    if (!teacherId || !effectiveAcademicYearId) return [] as TeacherAssignment[];
    const res = await api.get("/teacher-subject-classes", {
      params: { teacherId, academicYearId: effectiveAcademicYearId, page: 1, limit: 200 },
    });
    const payload = res.data?.data ?? res.data;
    if (Array.isArray(payload)) return payload as TeacherAssignment[];
    return (payload?.data ?? payload?.items ?? []) as TeacherAssignment[];
  }, [teacherId, effectiveAcademicYearId]);

  const {
    data: timetable,
    loading: loadingTimetable,
    error: timetableError,
  } = useAsync(async () => {
    if (!teacherId || !effectiveAcademicYearId) return {} as Record<string, any[]>;
    return await getTeacherTimetable(teacherId, { academicYearId: effectiveAcademicYearId });
  }, [teacherId, effectiveAcademicYearId]);

  const timetableSummary = useMemo(() => {
    const entries = Object.entries(timetable ?? {});
    return entries.map(([day, slots]) => ({
      day,
      count: Array.isArray(slots) ? slots.length : 0,
    }));
  }, [timetable]);

  const hasTimetable = useMemo(
    () => timetableSummary.some((item) => item.count > 0),
    [timetableSummary]
  );

  const hasAssignments = useMemo(
    () => (assignments ?? []).length > 0,
    [assignments]
  );

  const derivedAssignments = useMemo(() => {
    const slots = Object.values(timetable ?? {}).flat();
    const map = new Map<string, TeacherAssignment>();
    slots.forEach((slot: any) => {
      const classId = slot.section?.class?.id ?? slot.section?.classId ?? "class";
      const sectionId = slot.section?.id ?? slot.sectionId ?? "section";
      const subjectId = slot.classSubject?.subject?.id ?? slot.classSubjectId ?? "subject";
      const key = `${classId}:${sectionId}:${subjectId}`;
      if (map.has(key)) return;
      map.set(key, {
        id: key,
        sectionId,
        academicYearId: effectiveAcademicYearId,
        classSubject: {
          class: { className: slot.section?.class?.className ?? "Class" },
          subject: { name: slot.classSubject?.subject?.name ?? "Subject" },
        },
        section: { sectionName: slot.section?.sectionName ?? "" },
      });
    });
    return Array.from(map.values());
  }, [timetable, effectiveAcademicYearId]);

  const resolvedAssignments = hasAssignments ? (assignments ?? []) : derivedAssignments;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational History"
        subtitle="Timetables and teaching assignments by academic year."
      />

      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
        includeAllOption
        allLabel="Latest Year"
      />

      {!effectiveAcademicYearId ? (
        <Card>
          <EmptyState
            title="Select an academic year"
            description="Choose an academic year to view your timetable and assignments."
          />
        </Card>
      ) : null}

      <Card title="Timetable" subtitle="Weekly timetable for the selected academic year">
        {loadingTimetable ? (
          <LoadingState label="Loading timetable" />
        ) : timetableError ? (
          <p className="text-sm text-sunrise-600">{timetableError}</p>
        ) : hasTimetable ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(timetable ?? {}).map(([day, slots]) => (
              <div
                key={day}
                className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                  {day}
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  {(Array.isArray(slots) ? slots : []).map((slot, index) => (
                    <div
                      key={`${day}-${slot.period?.periodNumber ?? index}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-ink-700">
                          {slot.classSubject?.subject?.name ?? "Subject"}
                        </p>
                        <p className="text-xs text-ink-400">
                          {slot.section?.class?.className ?? "Class"}
                          {slot.section?.sectionName ? ` ${slot.section.sectionName}` : ""}
                          {slot.period?.periodNumber ? ` • Period ${slot.period.periodNumber}` : ""}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-ink-500">
                        {slot.roomNo ? `Room ${slot.roomNo}` : "Room —"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No timetable assigned"
            description="No timetable is available for the selected academic year."
          />
        )}
      </Card>

      <Card title="Subject Assignments" subtitle="Classes and subjects for the selected academic year">
        {loadingAssignments ? (
          <LoadingState label="Loading assignments" />
        ) : assignmentsError ? (
          <p className="text-sm text-sunrise-600">{assignmentsError}</p>
        ) : resolvedAssignments.length > 0 ? (
          <div className="grid gap-3">
            {resolvedAssignments.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {item.classSubject?.class?.className ?? "Class"}
                  {item.section?.sectionName ? ` - ${item.section.sectionName}` : ""}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {item.classSubject?.subject?.name ?? "Subject"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No assignments"
            description="No subject assignments found for the selected academic year."
          />
        )}
      </Card>
    </div>
  );
}
