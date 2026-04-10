import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import SecureImage from "../../components/SecureImage";
import {
  getAttendanceContext,
  getClassTeacherAttendanceContext,
  listStudentAttendance,
  markAttendance,
  updateAttendance,
} from "../../services/api/attendance";
import { useAsync } from "../../hooks/useAsync";
import { formatTime } from "../../utils/time";

const STATUS_OPTIONS = ["PRESENT", "ABSENT"];

export default function AttendanceTeacherPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString();
  });

  const { data: context, loading: contextLoading, error: contextError } = useAsync(
    () => getAttendanceContext(),
    []
  );

  const { data, loading, error: loadError } = useAsync(
    () => getClassTeacherAttendanceContext(),
    []
  );

  useEffect(() => {
    if (!academicYearId && context?.academicYearId) {
      setAcademicYearId(context.academicYearId);
    }
  }, [context?.academicYearId, academicYearId]);

  useEffect(() => {
    if (!sectionId && context?.sectionId) {
      setSectionId(context.sectionId);
    }
  }, [context?.sectionId, sectionId]);

  const selectedSection = useMemo(() => {
    return data?.sections?.find((section) => section.id === sectionId) ?? null;
  }, [data?.sections, sectionId]);

  const studentsForSection = useMemo(() => selectedSection?.students ?? [], [selectedSection]);

  useEffect(() => {
    if (studentsForSection.length) {
      setStatusMap((prev) => {
        const nextMap: Record<string, string> = {};
        studentsForSection.forEach((student: { id: string }) => {
          nextMap[student.id] = prev[student.id] ?? "PRESENT";
        });
        return nextMap;
      });
    } else {
      setStatusMap({});
    }
  }, [studentsForSection]);

  useEffect(() => {
    // No timetable slot dependency for attendance
  }, []);

  const handleSubmit = async () => {
    setMessage(null);
    setError(null);
    if (!context || !sectionId || !academicYearId) {
      setError("Attendance context is not ready. Please try again.");
      return;
    }
    if (context.isOpen === false) {
      setError("Attendance is closed. Please wait for the next window.");
      return;
    }
    setLoadingSubmit(true);
    try {
      const records = studentsForSection.map((student: { id: string }) => ({
        studentId: student.id,
        status: statusMap[student.id] ?? "PRESENT",
      }));
      await markAttendance({ records });
      setMessage("Attendance marked successfully.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to mark attendance");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!context?.nextOpenAt) {
      setCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const now = new Date();
      const nextOpen = new Date(context.nextOpenAt as string);
      if (Number.isNaN(nextOpen.getTime())) {
        setCountdown(null);
        return;
      }
      const diff = nextOpen.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("Attendance is now open.");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [context?.nextOpenAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [editRecords, setEditRecords] = useState<Array<{ id: string; studentId: string; status: string; remarks?: string | null; student?: { fullName?: string } }>>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editSearch, setEditSearch] = useState("");

  const fetchEditRecords = async () => {
    if (!sectionId || !academicYearId) return;
    setLoadingEdit(true);
    try {
      const res = await listStudentAttendance({
        sectionId,
        academicYearId,
        fromDate: attendanceDate,
        toDate: attendanceDate,
        limit: 200,
      });
      setEditRecords(res?.data ?? res ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingEdit(false);
    }
  };

  useEffect(() => {
    if (context) {
      fetchEditRecords();
    }
  }, [sectionId, academicYearId, attendanceDate, context]);

  const handleUpdate = async (recordId: string, status: string) => {
    setMessage(null);
    setError(null);
    try {
      await updateAttendance(recordId, { status, correctionReason: "Updated by teacher" });
      setMessage("Attendance updated.");
      await fetchEditRecords();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update attendance");
    }
  };

  if (contextLoading || loading) {
    return <LoadingState label="Loading attendance tools" />;
  }

  if (contextError || loadError) {
    return (
      <Card>
        <p className="text-sm text-sunrise-600">{contextError ?? loadError}</p>
      </Card>
    );
  }

  if (!data?.sections?.length || !context) {
    return (
      <Card title="Attendance">
        <p className="text-sm text-ink-500">
          No class assignment available for the active academic year.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Attendance" subtitle="Mark and edit daily attendance" />
      <Card title="Mark Attendance">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink-700">Class</span>
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
              {context?.className ?? selectedSection?.className ?? "—"}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink-700">Section</span>
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
              {context?.sectionName ?? selectedSection?.sectionName ?? "—"}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink-700">Date</span>
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
              {context?.date ? context.date.slice(0, 10) : attendanceDate}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink-700">Current Time</span>
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
              {nowTime}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink-700">Session</span>
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
              First Period
            </div>
          </div>
        </div>
        {context?.nextOpenAt && countdown && (
          <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-600">
            Next attendance opens in {countdown}
          </div>
        )}
        {context?.isOpen === false && (
          <div className="mt-3 rounded-xl border border-sunrise-200 bg-sunrise-50 px-3 py-2 text-sm text-sunrise-700">
            Attendance is closed. It opens at {formatTime(context.startTime ?? "09:00")} and closes at {formatTime(context.endTime ?? "14:45")}.
          </div>
        )}
        {studentsForSection.length && context?.isOpen !== false ? (
          <div className="mt-4">
            <Table columns={["Student", "Present", "Absent"]}>
              {studentsForSection.map((student) => {
                const isPresent = statusMap[student.id] !== "ABSENT";
                return (
                  <tr key={student.id} className="rounded-lg bg-white shadow-soft">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full bg-ink-100 flex items-center justify-center text-xs font-semibold text-ink-600">
                          {student.profilePhotoUrl ? (
                            <SecureImage
                              fileUrl={student.profilePhotoUrl}
                              alt={student.fullName ?? "Student"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (student.fullName ?? "S").slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span>{student.fullName ?? student.id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setStatusMap((prev) => ({ ...prev, [student.id]: "PRESENT" }))
                        }
                        className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                          isPresent
                            ? "bg-jade-600 text-white"
                            : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                        }`}
                      >
                        Present
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setStatusMap((prev) => ({ ...prev, [student.id]: "ABSENT" }))
                        }
                        className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                          !isPresent
                            ? "bg-sunrise-600 text-white"
                            : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                        }`}
                      >
                        Absent
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={context?.isOpen === false ? "Attendance Closed" : "Select a section"}
              description={
                context?.isOpen === false
                  ? "Attendance window is closed for today."
                  : "Choose a section to load students."
              }
            />
          </div>
        )}
        {message && <p className="mt-3 text-sm text-jade-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-sunrise-600">{error}</p>}
        {context?.alreadySubmitted && (
          <p className="mt-3 text-sm text-sunrise-600">
            Attendance already taken today for this section.
          </p>
        )}
        <div className="mt-4">
          <Button
            onClick={handleSubmit}
            disabled={
              loadingSubmit ||
              !context ||
              context.alreadySubmitted ||
              context.isOpen === false
            }
          >
            {loadingSubmit ? "Saving..." : "Submit Attendance"}
          </Button>
        </div>
      </Card>
      <Card title="Edit Same-Day Attendance" description="Update records marked today">
        {context?.isOpen === false && (
          <div className="mb-3 rounded-xl border border-sunrise-200 bg-sunrise-50 px-3 py-2 text-sm text-sunrise-700">
            Editing is available only during school hours ({formatTime(context.startTime ?? "09:00")} - {formatTime(context.endTime ?? "14:45")}).
          </div>
        )}
        <div className="mb-4">
          <input
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-200"
            placeholder="Search student name or ID..."
            value={editSearch}
            onChange={(e) => setEditSearch(e.target.value)}
          />
        </div>
        {loadingEdit ? (
          <LoadingState label="Loading records" />
        ) : editRecords.length ? (
          editSearch.trim() ? (
            <Table columns={["Student", "Status", "Update"]}>
              {editRecords
                .filter((record) => {
                  const query = editSearch.trim().toLowerCase();
                  const name = (record as any).student?.fullName?.toLowerCase() ?? "";
                  const id = record.studentId.toLowerCase();
                  return name.includes(query) || id.includes(query);
                })
                .map((record) => (
                <tr key={record.id} className="rounded-lg bg-white shadow-soft">
                  <td className="px-3 py-3">{(record as any).student?.fullName ?? record.studentId}</td>
                  <td className="px-3 py-3">{record.status}</td>
                  <td className="px-3 py-3">
                    <select
                      disabled={context?.isOpen === false}
                      className="rounded-lg border border-ink-200 px-2 py-1 text-sm"
                      defaultValue={record.status}
                      onChange={(event) => handleUpdate(record.id, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="Search required"
              description="Search a student to edit attendance."
            />
          )
        ) : (
          <EmptyState title="No records" description="No attendance records found for the selected date." />
        )}
      </Card>
    </div>
  );
}
