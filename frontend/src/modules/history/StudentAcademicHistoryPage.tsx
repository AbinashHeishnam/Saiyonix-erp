import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Button from "../../components/Button";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import TransitionCountdownCard from "../../components/TransitionCountdownCard";
import { useAuth } from "../../contexts/AuthContext";
import { getParentDashboard } from "../../services/api/dashboard";
import {
  getAcademicYearTransitionMeta,
  getActiveAcademicYear,
  getPreviousAcademicYear,
} from "../../services/api/metadata";
import { getStudentMe, getStudentHistory } from "../../services/api/students";
import { sendMessage } from "../../services/api/messages";
import { useAsync } from "../../hooks/useAsync";

export default function StudentAcademicHistoryPage() {
  const { role } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);

  const { data: meData } = useAsync(() => (role === "STUDENT" ? getStudentMe() : Promise.resolve(null)), [role]);
  const { data: parentDashboard } = useAsync(
    () => (role === "PARENT" ? getParentDashboard() : Promise.resolve(null)),
    [role]
  );

  useEffect(() => {
    if (role === "STUDENT" && meData?.id) {
      setStudentId(meData.id);
    }
    if (role === "PARENT" && parentDashboard?.children?.length) {
      setStudentId(parentDashboard.children[0].studentId);
    }
  }, [role, meData, parentDashboard]);

  const { data: history, loading, error } = useAsync(
    () => (studentId ? getStudentHistory(studentId) : Promise.resolve(null)),
    [studentId]
  );

  const { data: transitionMeta } = useAsync(getAcademicYearTransitionMeta, []);
  const { data: activeYear } = useAsync(getActiveAcademicYear, []);
  const { data: previousYear } = useAsync(getPreviousAcademicYear, []);

  const timeline = useMemo(() => history?.timeline ?? [], [history]);

  const handleDownloadSummary = () => {
    if (!timeline.length) return;
    const headers = ["Academic Year", "Attendance %", "Result %", "Promotion"];
    const rows = timeline.map((item: any) => [
      item.academicYear?.label ?? "—",
      item.attendance?.attendancePercent ?? "—",
      item.performance?.percentage ?? "—",
      item.systemTrace?.promotionType ?? "—",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map((value) => `"${value}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student-history-summary.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendMessage = async (teacherUserId?: string | null) => {
    if (!teacherUserId || !message.trim()) return;
    setMessageError(null);
    setSending(true);
    try {
      await sendMessage({ receiverId: teacherUserId, message: message.trim() });
      setMessage("");
    } catch (err: any) {
      setMessageError(err?.response?.data?.message ?? "Unable to send message");
    } finally {
      setSending(false);
    }
  };

  const parentOptions = parentDashboard?.children ?? [];
  const activeYearId = activeYear?.id ?? transitionMeta?.toAcademicYear?.id ?? null;
  const previousYearId = previousYear?.id ?? transitionMeta?.fromAcademicYear?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic History"
        subtitle="View past academic years and promotion outcomes."
        actions={
          <Button variant="secondary" onClick={handleDownloadSummary} disabled={!timeline.length}>
            Download Summary
          </Button>
        }
      />

      {role === "PARENT" && parentOptions.length > 0 ? (
        <Card title="Student Selection" subtitle="Select a student to view history.">
          <Select
            label="Student"
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {parentOptions.map((child: any) => (
              <option key={child.studentId} value={child.studentId}>
                {child.studentName ?? child.studentId}
              </option>
            ))}
          </Select>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Loading history" />
      ) : error ? (
        <EmptyState title="Unable to load history" description={error} />
      ) : timeline.length === 0 ? (
        <EmptyState title="No history yet" description="No academic history records were found." />
      ) : (
        <div className="space-y-4">
          {timeline.map((item: any) => {
            const year = item.academicYear;
            const isPreviousYear = Boolean(previousYearId && previousYearId === year?.id);
            const isActiveYear = Boolean(activeYearId && activeYearId === year?.id);
            const interactionAllowed = Boolean(isPreviousYear && transitionMeta?.canStudentInteract);
            const teacherUserId = item.classTeacher?.userId ?? null;
            return (
              <Card
                key={year?.id}
                title={year?.label ?? "Academic Year"}
                subtitle={
                  isActiveYear
                    ? "Current Academic Year"
                    : isPreviousYear
                      ? "Previous Academic Year"
                      : "Archived Year"
                }
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-slate-500">Class & Section</p>
                    <p className="font-semibold">{item.enrollment?.class?.className} {item.enrollment?.section?.sectionName}</p>
                    <p className="text-sm text-slate-500 mt-2">Roll Number</p>
                    <p className="font-semibold">{item.enrollment?.rollNumber ?? "—"}</p>
                    <p className="text-sm text-slate-500 mt-2">Class Teacher</p>
                    <p className="font-semibold">{item.classTeacher?.fullName ?? "Not assigned"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Attendance</p>
                    <p className="font-semibold">{item.attendance?.attendancePercent ?? 0}%</p>
                    <p className="text-sm text-slate-500 mt-2">Final Result</p>
                    <p className="font-semibold">{item.performance?.percentage ?? "—"}%</p>
                    <p className="text-sm text-slate-500 mt-2">Promotion</p>
                    <p className="font-semibold">{item.systemTrace?.promotionType ?? "—"}</p>
                  </div>
                </div>

                {isPreviousYear ? (
                  <div className="mt-4">
                    <TransitionCountdownCard
                      title="Previous Year Interaction"
                      endsAt={transitionMeta?.studentWindowEndsAt ?? null}
                      allowed={transitionMeta?.canStudentInteract}
                    />
                    {interactionAllowed && teacherUserId ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          className="w-full rounded-md border border-slate-200 p-2 text-sm"
                          rows={2}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Send a clarification to your previous class teacher"
                        />
                        {messageError ? <p className="text-xs text-rose-600">{messageError}</p> : null}
                        <Button onClick={() => handleSendMessage(teacherUserId)} disabled={sending || !message.trim()}>
                          {sending ? "Sending..." : "Send Message"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2">Interaction Closed — View Only</p>
                    )}
                  </div>
                ) : null}

                {item.results?.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold">Report Cards</p>
                    <div className="mt-2 space-y-1 text-sm">
                      {item.results.map((result: any) => (
                        <div key={result.examId} className="flex items-center justify-between">
                          <span>{result.examTitle}</span>
                          <span className="text-slate-500">{result.percentage ?? "—"}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
