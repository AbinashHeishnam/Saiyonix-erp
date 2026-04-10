import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import StatusBadge from "../../components/StatusBadge";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import ConfirmDialog from "../../components/ConfirmDialog";

type Exam = {
  id: string;
  title: string;
  type?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  isPublished?: boolean;
  isLocked?: boolean;
  isFinalExam?: boolean;
};

type AcademicYear = { id: string; label?: string | null };
type ClassItem = { id: string; className: string };
type SectionItem = { id: string; sectionName: string; classId: string };
type SubjectItem = { id: string; name: string };
type ClassSubjectConfig = { classId: string; subjectIds: string[] };

type ScheduleRow = {
  subjectId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  shift: "MORNING" | "AFTERNOON";
};

type AllocationRow = {
  classId: string;
  sectionId: string;
  rollFrom: string;
  rollTo: string;
};

type AllocationRoom = {
  roomNumber: string;
  rows: AllocationRow[];
};

type ExamDetail = {
  id: string;
  title: string;
  type?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  isPublished?: boolean;
  isLocked?: boolean;
  isFinalExam?: boolean;
  timetablePublishedAt?: string | null;
  examSubjects?: Array<{
    id: string;
    classSubject?: {
      classId?: string | null;
      class?: { className?: string | null } | null;
      subject?: { name?: string | null } | null;
    } | null;
    timetable?: Array<{
      examDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      venue?: string | null;
    }>;
  }>;
};

export default function ExamsPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [createForm, setCreateForm] = useState({
    academicYearId: "",
    name: "",
    type: "TERM",
    startDate: "",
    endDate: "",
  });
  const [scheduleExamId, setScheduleExamId] = useState("");
  const [scheduleClassId, setScheduleClassId] = useState("");
  const [scheduleShift, setScheduleShift] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [classStartTime, setClassStartTime] = useState("");
  const [classEndTime, setClassEndTime] = useState("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [allocationExamId, setAllocationExamId] = useState("");
  const [allocationRooms, setAllocationRooms] = useState<AllocationRoom[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);
  const [deleteScheduleOpen, setDeleteScheduleOpen] = useState(false);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Record<string, ExamDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<{
    examId: string;
    classId: string;
    className?: string | null;
  } | null>(null);

  const { data: exams, refresh: refreshExams } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/exams", { params });
    return res.data?.data ?? res.data ?? [];
  }, [academicYearId]);

  const { data: academicYears } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 200 } });
    return res.data?.data ?? res.data ?? [];
  }, []);

  const { data: classes } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    return res.data?.data ?? res.data ?? [];
  }, [academicYearId]);

  const { data: sections } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/sections", { params });
    return res.data?.data ?? res.data ?? [];
  }, [academicYearId]);

  const { data: subjects, loading: loadingSubjects, error: subjectsError } = useAsync(async () => {
    const res = await api.get("/subjects", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, []);

  const { data: classSubjectConfig } = useAsync(async () => {
    if (!scheduleClassId) return null;
    const res = await api.get("/admin/class-subjects", {
      params: { classId: scheduleClassId },
    });
    const payload = res.data?.data ?? res.data ?? null;
    return (payload?.data ?? payload) as ClassSubjectConfig | null;
  }, [scheduleClassId]);

  const selectedExam = useMemo(
    () => (exams ?? []).find((exam: Exam) => exam.id === scheduleExamId) ?? null,
    [exams, scheduleExamId]
  );

  const enforceClassShift = selectedExam?.type && selectedExam.type !== "PERIODIC";

  const subjectOptions = useMemo(() => {
    if (!scheduleClassId) return [];
    return (subjects ?? []) as SubjectItem[];
  }, [scheduleClassId, subjects]);

  const hasClassSubjectMapping = useMemo(() => {
    if (!scheduleClassId) return false;
    return (classSubjectConfig?.subjectIds?.length ?? 0) > 0;
  }, [classSubjectConfig, scheduleClassId]);



  const allocationSectionOptions = useMemo(() => {
    const list = (sections ?? []) as SectionItem[];
    return list;
  }, [sections]);

  const handleCreateExam = async () => {
    setSaving(true);
    try {
      await safeApiCall(
        () => api.post("/admin/exam", {
          academicYearId: createForm.academicYearId || academicYearId,
          name: createForm.name,
          type: createForm.type,
          startDate: createForm.startDate,
          endDate: createForm.endDate,
        }),
        { loading: "Creating exam...", success: "Exam created successfully" }
      );
      setCreateForm({ academicYearId: "", name: "", type: "TERM", startDate: "", endDate: "" });
      refreshExams();
    } catch {
      // Handled by toast
    } finally {
      setSaving(false);
    }
  };

  const handleAddScheduleRow = () => {
    setScheduleRows((prev) => [
      ...prev,
      {
        subjectId: "",
        examDate: "",
        startTime: enforceClassShift ? classStartTime : "",
        endTime: enforceClassShift ? classEndTime : "",
        shift: enforceClassShift ? scheduleShift : "MORNING",
      },
    ]);
  };

  const handleSubmitSchedule = async () => {
    setSaving(true);
    try {
      await safeApiCall(
        () => api.post("/admin/exam/schedule", {
          examId: scheduleExamId,
          classId: scheduleClassId,
          schedules: scheduleRows,
        }),
        { loading: "Saving schedule...", success: "Exam schedule saved" }
      );
      setScheduleRows([]);
      if (scheduleExamId) {
        setExamDetails((prev) => {
          const next = { ...prev };
          delete next[scheduleExamId];
          return next;
        });
        if (expandedExamId === scheduleExamId) {
          void loadExamDetails(scheduleExamId);
        }
      }
      refreshExams();
    } catch {
      // Handled by toast
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleExamId || !scheduleClassId) return;
    setSaving(true);
    try {
      await safeApiCall(
        () =>
          api.post("/admin/exam/schedule/delete", {
            examId: scheduleExamId,
            classId: scheduleClassId,
          }),
        { loading: "Deleting schedule...", success: "Exam schedule deleted" }
      );
      setScheduleRows([]);
      if (scheduleExamId) {
        setExamDetails((prev) => {
          const next = { ...prev };
          delete next[scheduleExamId];
          return next;
        });
        if (expandedExamId === scheduleExamId) {
          void loadExamDetails(scheduleExamId);
        }
      }
      refreshExams();
    } catch {
      // toast handled
    } finally {
      setSaving(false);
      setDeleteScheduleOpen(false);
    }
  };

  const handleDeleteScheduleForClass = async () => {
    if (!deleteScheduleTarget) return;
    const { examId, classId } = deleteScheduleTarget;
    setSaving(true);
    try {
      await safeApiCall(
        () =>
          api.post("/admin/exam/schedule/delete", {
            examId,
            classId,
          }),
        { loading: "Deleting schedule...", success: "Exam schedule deleted" }
      );
      setScheduleRows([]);
      setExamDetails((prev) => {
        const next = { ...prev };
        delete next[examId];
        return next;
      });
      if (expandedExamId === examId) {
        void loadExamDetails(examId);
      }
      refreshExams();
    } catch {
      // toast handled
    } finally {
      setSaving(false);
      setDeleteScheduleTarget(null);
    }
  };



  const handleAddRoom = () => {
    setAllocationRooms((prev) => [
      ...prev,
      { roomNumber: "", rows: [{ classId: "", sectionId: "", rollFrom: "", rollTo: "" }] },
    ]);
  };

  const handleSubmitAllocations = async () => {
    setSaving(true);
    try {
      await safeApiCall(
        () => api.post("/admin/exam/room-allocation", {
          examId: allocationExamId,
          allocations: allocationRooms.flatMap((room) =>
            room.rows.map((row) => ({
              classId: row.classId,
              sectionId: row.sectionId,
              roomNumber: room.roomNumber,
              rollFrom: Number(row.rollFrom),
              rollTo: Number(row.rollTo),
            }))
          ),
        }),
        { loading: "Saving allocations...", success: "Room allocations saved" }
      );
      setAllocationRooms([]);
    } catch {
      // Handled by toast
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (examId: string) => {
    await safeApiCall(
      () => api.patch(`/admin/exam/${examId}/publish`),
      { loading: "Publishing exam...", success: "Exam published successfully" }
    );
    refreshExams();
  };

  const handleUnlock = async (examId: string) => {
    await safeApiCall(
      () => api.patch(`/admin/exam/${examId}/unlock`),
      { loading: "Unlocking exam...", success: "Exam unlocked successfully" }
    );
    refreshExams();
  };

  const handleToggleFinal = async (exam: Exam) => {
    await safeApiCall(
      () =>
        api.patch(`/admin/exam/${exam.id}/final`, {
          isFinalExam: !exam.isFinalExam,
        }),
      {
        loading: exam.isFinalExam ? "Removing final exam..." : "Setting final exam...",
        success: exam.isFinalExam ? "Final exam removed" : "Final exam set",
      }
    );
    refreshExams();
  };

  const handleDelete = async (examId: string) => {
    await safeApiCall(
      () => api.delete(`/admin/exam/${examId}`),
      { loading: "Deleting exam...", success: "Exam deleted successfully" }
    );
    refreshExams();
  };

  const loadExamDetails = async (examId: string) => {
    if (examDetails[examId] || detailsLoading[examId]) return;
    setDetailsLoading((prev) => ({ ...prev, [examId]: true }));
    try {
      const res = await api.get(`/exams/${examId}`, {
        params: { ts: Date.now() },
      });
      const payload = res.data?.data ?? res.data;
      if (payload) {
        setExamDetails((prev) => ({ ...prev, [examId]: payload }));
      }
    } catch {
      // handled by existing toast layer in api client
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const toggleDetails = async (examId: string) => {
    const next = expandedExamId === examId ? null : examId;
    setExpandedExamId(next);
    if (next) {
      await loadExamDetails(next);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  useEffect(() => {
    if (academicYearId && createForm.academicYearId !== academicYearId) {
      setCreateForm((prev) => ({ ...prev, academicYearId }));
    }
  }, [academicYearId, createForm.academicYearId]);

  useEffect(() => {
    setScheduleExamId("");
    setScheduleClassId("");
    setAllocationExamId("");
    setAllocationRooms([]);
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Exam Management" subtitle="Create exams, schedules, and room allocations." />
      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
      />

      <Card title="Create Exam">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Select
            label="Academic Year"
            value={createForm.academicYearId}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, academicYearId: event.target.value }))
            }
          >
            <option value="">Select academic year</option>
            {(academicYears ?? []).map((year: AcademicYear) => (
              <option key={year.id} value={year.id}>
                {year.label ?? year.id}
              </option>
            ))}
          </Select>
          <Input
            label="Exam Name"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="1st Term, Final, Periodic Test 1"
          />
          <Select
            label="Exam Type"
            value={createForm.type}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="PERIODIC">Periodic</option>
            <option value="TERM">Term</option>
            <option value="FINAL">Final</option>
          </Select>
          <Input
            label="Start Date"
            type="date"
            value={createForm.startDate}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <Input
            label="End Date"
            type="date"
            value={createForm.endDate}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleCreateExam} loading={saving}>Create Exam</Button>
        </div>
      </Card>

      <Card title="Add Exam Schedule">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Select
            label="Exam"
            value={scheduleExamId}
            onChange={(event) => setScheduleExamId(event.target.value)}
          >
            <option value="">Select exam</option>
            {(exams ?? []).map((exam: Exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </Select>
          <Select
            label="Class"
            value={scheduleClassId}
            onChange={(event) => setScheduleClassId(event.target.value)}
          >
            <option value="">Select class</option>
            {(classes ?? []).map((item: ClassItem) => (
              <option key={item.id} value={item.id}>
                {item.className}
              </option>
            ))}
          </Select>
          {enforceClassShift && (
            <Select
              label="Class Shift"
              value={scheduleShift}
              onChange={(event) => {
                const value = event.target.value as "MORNING" | "AFTERNOON";
                setScheduleShift(value);
                setScheduleRows((prev) =>
                  prev.map((item) => ({ ...item, shift: value }))
                );
              }}
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
            </Select>
          )}
          {enforceClassShift && (
            <Input
              label="Class Start Time"
              type="time"
              value={classStartTime}
              onChange={(event) => {
                const value = event.target.value;
                setClassStartTime(value);
                setScheduleRows((prev) => prev.map((item) => ({ ...item, startTime: value })));
              }}
            />
          )}
          {enforceClassShift && (
            <Input
              label="Class End Time"
              type="time"
              value={classEndTime}
              onChange={(event) => {
                const value = event.target.value;
                setClassEndTime(value);
                setScheduleRows((prev) => prev.map((item) => ({ ...item, endTime: value })));
              }}
            />
          )}
        </div>
        {subjectsError && (
          <p className="mt-3 text-xs text-sunrise-600">
            {subjectsError}
          </p>
        )}
        {scheduleClassId && !loadingSubjects && subjectOptions.length === 0 && !subjectsError && (
          <p className="mt-3 text-xs text-sunrise-600">
            No subjects found. Please create subjects and map them to this class.
          </p>
        )}
        {!hasClassSubjectMapping && scheduleClassId && !loadingSubjects && subjectOptions.length > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            No class-subject mapping found for this class. Showing all subjects.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {scheduleRows.length > 0 && (
            <div className="grid grid-cols-1 gap-3 text-xs font-semibold text-ink-500 lg:grid-cols-6">
              <span>Subject</span>
              <span>Date</span>
              <span>Start</span>
              <span>End</span>
              <span>Shift</span>
              <span>Action</span>
            </div>
          )}
          {scheduleRows.map((row, idx) => (
            <div key={`schedule-${idx}`} className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <Select
                label="Subject"
                value={row.subjectId}
                onChange={(event) => {
                  const value = event.target.value;
                  setScheduleRows((prev) => prev.map((item, i) => i === idx ? { ...item, subjectId: value } : item));
                }}
              >
                <option value="">Select</option>
                {subjectOptions.map((subject: SubjectItem) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Exam Date"
                type="date"
                value={row.examDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setScheduleRows((prev) => prev.map((item, i) => i === idx ? { ...item, examDate: value } : item));
                }}
              />
              <Input
                label="Start"
                type="time"
                value={row.startTime}
                onChange={(event) => {
                  const value = event.target.value;
                  setScheduleRows((prev) => prev.map((item, i) => i === idx ? { ...item, startTime: value } : item));
                }}
                disabled={enforceClassShift}
              />
              <Input
                label="End"
                type="time"
                value={row.endTime}
                onChange={(event) => {
                  const value = event.target.value;
                  setScheduleRows((prev) => prev.map((item, i) => i === idx ? { ...item, endTime: value } : item));
                }}
                disabled={enforceClassShift}
              />
              <Select
                label="Shift"
                value={row.shift}
                onChange={(event) => {
                  const value = event.target.value as "MORNING" | "AFTERNOON";
                  setScheduleRows((prev) => prev.map((item, i) => i === idx ? { ...item, shift: value } : item));
                }}
                disabled={enforceClassShift}
              >
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
              </Select>
              <Button
                variant="ghost"
                onClick={() => setScheduleRows((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" onClick={handleAddScheduleRow}>
            Add Row
          </Button>
          <Button onClick={handleSubmitSchedule} loading={saving} disabled={!scheduleRows.length}>
            Save Schedule
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDeleteScheduleOpen(true)}
            disabled={!scheduleExamId || !scheduleClassId}
          >
            Delete Schedule
          </Button>
        </div>
      </Card>

      <Card title="Room Allocation">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Select
            label="Exam"
            value={allocationExamId}
            onChange={(event) => setAllocationExamId(event.target.value)}
          >
            <option value="">Select exam</option>
            {(exams ?? []).map((exam: Exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {allocationRooms.map((room, roomIdx) => (
            <div key={`room-${roomIdx}`} className="rounded-2xl border border-ink-100 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Input
                  label="Room Number"
                  value={room.roomNumber}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAllocationRooms((prev) =>
                      prev.map((item, i) => i === roomIdx ? { ...item, roomNumber: value } : item)
                    );
                  }}
                />
                <div className="flex items-end gap-2 lg:col-span-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setAllocationRooms((prev) =>
                        prev.map((item, i) =>
                          i === roomIdx
                            ? {
                              ...item,
                              rows: [
                                ...item.rows,
                                { classId: "", sectionId: "", rollFrom: "", rollTo: "" },
                              ],
                            }
                            : item
                        )
                      )
                    }
                  >
                    Add Class/Section
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setAllocationRooms((prev) => prev.filter((_, i) => i !== roomIdx))
                    }
                  >
                    Remove Room
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {room.rows.map((row, idx) => (
                  <div key={`alloc-${roomIdx}-${idx}`} className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <Select
                      label="Class"
                      value={row.classId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAllocationRooms((prev) =>
                          prev.map((item, i) =>
                            i === roomIdx
                              ? {
                                ...item,
                                rows: item.rows.map((r, ri) =>
                                  ri === idx ? { ...r, classId: value, sectionId: "" } : r
                                ),
                              }
                              : item
                          )
                        );
                      }}
                    >
                      <option value="">Select</option>
                      {(classes ?? []).map((item: ClassItem) => (
                        <option key={item.id} value={item.id}>
                          {item.className}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Section"
                      value={row.sectionId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAllocationRooms((prev) =>
                          prev.map((item, i) =>
                            i === roomIdx
                              ? {
                                ...item,
                                rows: item.rows.map((r, ri) =>
                                  ri === idx ? { ...r, sectionId: value } : r
                                ),
                              }
                              : item
                          )
                        );
                      }}
                    >
                      <option value="">Select</option>
                      {allocationSectionOptions
                        .filter((sec) => !row.classId || sec.classId === row.classId)
                        .map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.sectionName}
                          </option>
                        ))}
                    </Select>
                    <Input
                      label="Roll From"
                      type="number"
                      value={row.rollFrom}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAllocationRooms((prev) =>
                          prev.map((item, i) =>
                            i === roomIdx
                              ? {
                                ...item,
                                rows: item.rows.map((r, ri) =>
                                  ri === idx ? { ...r, rollFrom: value } : r
                                ),
                              }
                              : item
                          )
                        );
                      }}
                    />
                    <Input
                      label="Roll To"
                      type="number"
                      value={row.rollTo}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAllocationRooms((prev) =>
                          prev.map((item, i) =>
                            i === roomIdx
                              ? {
                                ...item,
                                rows: item.rows.map((r, ri) =>
                                  ri === idx ? { ...r, rollTo: value } : r
                                ),
                              }
                              : item
                          )
                        );
                      }}
                    />
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setAllocationRooms((prev) =>
                          prev.map((item, i) =>
                            i === roomIdx
                              ? { ...item, rows: item.rows.filter((_, ri) => ri !== idx) }
                              : item
                          )
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" onClick={handleAddRoom}>
            Add Room
          </Button>
          <Button onClick={handleSubmitAllocations} loading={saving} disabled={!allocationRooms.length}>
            Save Allocations
          </Button>
        </div>
      </Card>

      <Card title="Publish Exams">
        <div className="grid gap-3 sm:grid-cols-2">
          {(exams ?? []).map((exam: Exam) => (
            <div key={exam.id} className="rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{exam.title}</p>
                  <p className="text-xs text-ink-500">
                    {exam.type ?? "TERM"} • {formatDate(exam.startsOn)} → {formatDate(exam.endsOn)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {exam.isLocked && (
                    <StatusBadge variant="danger" dot={false}>
                      Locked
                    </StatusBadge>
                  )}
                  <StatusBadge variant={exam.isPublished ? "success" : "warning"} dot={false}>
                    {exam.isPublished ? "Published" : "Draft"}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={exam.isPublished}
                    onClick={() => handlePublish(exam.id)}
                  >
                    Publish Exam
                  </Button>
                  {exam.isLocked && (
                    <Button
                      variant="ghost"
                      onClick={() => handleUnlock(exam.id)}
                    >
                      Unlock Exam
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => void toggleDetails(exam.id)}
                  >
                    {expandedExamId === exam.id ? "Hide Details" : "View Details"}
                  </Button>
                  <Button
                    variant={exam.isFinalExam ? "secondary" : "ghost"}
                    onClick={() => handleToggleFinal(exam)}
                  >
                    {exam.isFinalExam ? "Final Exam" : "Set Final"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteExamId(exam.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {expandedExamId === exam.id && (
                <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-xs text-ink-600">
                  {detailsLoading[exam.id] ? (
                    <p>Loading details...</p>
                  ) : (
                    (() => {
                      const detail = examDetails[exam.id];
                      if (!detail) return <p>Details unavailable.</p>;
                      const subjects = detail.examSubjects ?? [];
                      const classNames = Array.from(
                        new Set(
                          subjects
                            .map((item) => item.classSubject?.class?.className)
                            .filter(Boolean) as string[]
                        )
                      );
                      const subjectNames = Array.from(
                        new Set(
                          subjects
                            .map((item) => item.classSubject?.subject?.name)
                            .filter(Boolean) as string[]
                        )
                      );
                      const classEntries = Array.from(
                        new Map(
                          subjects
                            .map((item) => {
                              const classId = item.classSubject?.classId ?? null;
                              const className = item.classSubject?.class?.className ?? null;
                              if (!classId) return null;
                              return [classId, { classId, className }];
                            })
                            .filter(Boolean) as Array<
                              [string, { classId: string; className?: string | null }]
                            >
                        ).values()
                      );
                      const scheduleCount = subjects.reduce(
                        (count, item) => count + (item.timetable?.length ?? 0),
                        0
                      );
                      const scheduleCountByClass = subjects.reduce<Record<string, number>>(
                        (acc, item) => {
                          const classId = item.classSubject?.classId;
                          if (!classId) return acc;
                          acc[classId] = (acc[classId] ?? 0) + (item.timetable?.length ?? 0);
                          return acc;
                        },
                        {}
                      );
                      return (
                        <div className="grid gap-2">
                          <div className="flex flex-wrap gap-3">
                            <span><strong>Type:</strong> {detail.type ?? exam.type ?? "TERM"}</span>
                            <span><strong>Start:</strong> {formatDate(detail.startsOn ?? exam.startsOn)}</span>
                            <span><strong>End:</strong> {formatDate(detail.endsOn ?? exam.endsOn)}</span>
                            <span><strong>Schedule Rows:</strong> {scheduleCount}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="font-semibold text-ink-700">Classes:</span>
                            {classNames.length ? classNames.map((name) => (
                              <span key={name} className="rounded-full bg-white px-2 py-0.5">{name}</span>
                            )) : <span>—</span>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="font-semibold text-ink-700">Subjects:</span>
                            {subjectNames.length ? subjectNames.map((name) => (
                              <span key={name} className="rounded-full bg-white px-2 py-0.5">{name}</span>
                            )) : <span>—</span>}
                          </div>
                          {classEntries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-ink-700">Delete Schedule:</span>
                              {classEntries.map((entry) => {
                                const count = scheduleCountByClass[entry.classId] ?? 0;
                                return (
                                  <Button
                                    key={entry.classId}
                                    variant="ghost"
                                    disabled={count === 0}
                                    onClick={() =>
                                      setDeleteScheduleTarget({
                                        examId: exam.id,
                                        classId: entry.classId,
                                        className: entry.className ?? undefined,
                                      })
                                    }
                                  >
                                    {entry.className ?? "Class"} ({count})
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <ConfirmDialog
        open={Boolean(deleteExamId)}
        onClose={() => setDeleteExamId(null)}
        onConfirm={() => {
          if (deleteExamId) void handleDelete(deleteExamId);
        }}
        title="Delete Exam"
        message="Are you sure you want to delete this exam? This cannot be undone."
        variant="danger"
        confirmText="Delete"
      />
      <ConfirmDialog
        open={deleteScheduleOpen}
        onClose={() => setDeleteScheduleOpen(false)}
        onConfirm={() => {
          void handleDeleteSchedule();
        }}
        title="Delete Exam Schedule"
        message="Are you sure you want to delete the schedule for this exam and class?"
        variant="danger"
        confirmText="Delete Schedule"
      />
      <ConfirmDialog
        open={Boolean(deleteScheduleTarget)}
        onClose={() => setDeleteScheduleTarget(null)}
        onConfirm={() => {
          void handleDeleteScheduleForClass();
        }}
        title="Delete Exam Schedule"
        message={
          deleteScheduleTarget?.className
            ? `Are you sure you want to delete the schedule for ${deleteScheduleTarget.className}?`
            : "Are you sure you want to delete the schedule for this class?"
        }
        variant="danger"
        confirmText="Delete Schedule"
      />
    </div>
  );
}
