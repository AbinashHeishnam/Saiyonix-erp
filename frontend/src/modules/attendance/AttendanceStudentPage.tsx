import { useEffect, useMemo, useState } from "react";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { listStudentAttendance } from "../../services/api/attendance";
import { getParentDashboard, getStudentDashboard } from "../../services/api/dashboard";
import { listStudents } from "../../services/api/metadata";

export default function AttendanceStudentPage() {
  const { role, user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [records, setRecords] = useState<Array<{ id: string; attendanceDate: string; status: string }>>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: studentDashboard } = useAsync(
    () => (role === "STUDENT" ? getStudentDashboard() : Promise.resolve(null)),
    [role]
  );

  const { data: parentDashboard } = useAsync(
    () => (role === "PARENT" ? getParentDashboard() : Promise.resolve(null)),
    [role]
  );

  useEffect(() => {
    const loadStudentId = async () => {
      if (role === "STUDENT" && user?.id) {
        const res = await listStudents();
        const students = res?.data ?? res ?? [];
        const student = students.find((item: { userId?: string }) => item.userId === user.id);
        setStudentId(student?.id ?? null);
      }
      if (role === "PARENT" && parentDashboard?.children?.length) {
        setStudentId(parentDashboard.children[0].studentId);
      }
    };
    loadStudentId();
  }, [role, user?.id, parentDashboard?.children]);

  const attendanceSummary = useMemo(() => {
    if (role === "STUDENT") return studentDashboard?.attendanceSummary ?? null;
    if (role === "PARENT") {
      return parentDashboard?.children?.find((child: { studentId: string }) => child.studentId === studentId)
        ?.attendanceSummary ?? null;
    }
    return null;
  }, [role, studentDashboard, parentDashboard, studentId]);

  const fetchRecords = async () => {
    if (!studentId) return;
    setLoadingRecords(true);
    setError(null);
    try {
      const res = await listStudentAttendance({ studentId, fromDate: fromDate || undefined, toDate: toDate || undefined });
      setRecords(res?.data ?? res ?? []);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to load attendance");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [studentId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Attendance" subtitle="Track attendance records" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Attendance %">
          <p className="text-3xl font-display font-semibold text-ink-900">
            {attendanceSummary?.attendancePercentage ?? 0}%
          </p>
        </Card>
        <Card title="Present Days">
          <p className="text-2xl font-display font-semibold text-ink-900">
            {attendanceSummary?.presentDays ?? 0}
          </p>
        </Card>
        <Card title="Absent Days">
          <p className="text-2xl font-display font-semibold text-ink-900">
            {attendanceSummary?.absentDays ?? 0}
          </p>
        </Card>
      </div>
      <Card title="Attendance Records" description="Filter by date range">
        {role === "PARENT" && parentDashboard?.children?.length ? (
          <div className="mb-4">
            <label className="text-sm font-semibold text-ink-700">Select Child</label>
            <select
              className="mt-2 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
              value={studentId ?? ""}
              onChange={(event) => setStudentId(event.target.value)}
            >
              {parentDashboard.children.map((child: { studentId: string; studentName?: string; className?: string; sectionName?: string }) => (
                <option key={child.studentId} value={child.studentId}>
                  {child.studentName ?? child.studentId}
                  {child.className ? ` · ${child.className}` : ""}
                  {child.sectionName ? ` ${child.sectionName}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="text-ink-600">From</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-ink-600">To</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <button
            className="mt-6 rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white"
            onClick={fetchRecords}
          >
            Apply
          </button>
        </div>
        {loadingRecords ? (
          <div className="mt-4">
            <LoadingState label="Loading attendance" />
          </div>
        ) : error ? (
          <p className="mt-4 text-sm text-sunrise-600">{error}</p>
        ) : records.length ? (
          <div className="mt-4">
            <Table columns={["Date", "Status"]}>
              {records.map((record) => (
                <tr key={record.id} className="rounded-lg bg-white shadow-soft">
                  <td className="px-3 py-3">{record.attendanceDate?.slice(0, 10)}</td>
                  <td className="px-3 py-3 font-semibold text-ink-800">{record.status}</td>
                </tr>
              ))}
            </Table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No attendance records" description="No attendance data found for the selected dates." />
          </div>
        )}
      </Card>
    </div>
  );
}
