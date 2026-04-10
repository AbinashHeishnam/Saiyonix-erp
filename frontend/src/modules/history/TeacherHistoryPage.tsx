import { useMemo, useState } from "react";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import TransitionCountdownCard from "../../components/TransitionCountdownCard";
import { useAsync } from "../../hooks/useAsync";
import {
  getAcademicYearTransitionMeta,
  getActiveAcademicYear,
  getPreviousAcademicYear,
} from "../../services/api/metadata";
import { getTeacherHistory } from "../../services/api/teacherHistory";
import Button from "../../components/Button";
import { Link } from "react-router-dom";
import Select from "../../components/Select";
import { getTeacherContacts, sendMessage } from "../../services/api/messages";

export default function TeacherHistoryPage() {
  const { data, loading, error } = useAsync(getTeacherHistory, []);
  const { data: transitionMeta } = useAsync(getAcademicYearTransitionMeta, []);
  const { data: activeYear } = useAsync(getActiveAcademicYear, []);
  const { data: previousYear } = useAsync(getPreviousAcademicYear, []);
  const { data: contacts } = useAsync(getTeacherContacts, []);
  const timeline = useMemo(() => data?.timeline ?? [], [data]);
  const activeYearId = activeYear?.id ?? transitionMeta?.toAcademicYear?.id ?? null;
  const previousYearId = previousYear?.id ?? transitionMeta?.fromAcademicYear?.id ?? null;
  const [messageByYear, setMessageByYear] = useState<Record<string, string>>({});
  const [selectedContactByYear, setSelectedContactByYear] = useState<Record<string, string>>({});
  const [sendingYear, setSendingYear] = useState<string | null>(null);
  const [errorByYear, setErrorByYear] = useState<Record<string, string | null>>({});

  const handleSendMessage = async (yearId: string) => {
    const receiverId = selectedContactByYear[yearId];
    const message = messageByYear[yearId]?.trim() ?? "";
    if (!receiverId || !message) return;
    setSendingYear(yearId);
    setErrorByYear((prev) => ({ ...prev, [yearId]: null }));
    try {
      await sendMessage({ receiverId, message });
      setMessageByYear((prev) => ({ ...prev, [yearId]: "" }));
    } catch (err: any) {
      setErrorByYear((prev) => ({
        ...prev,
        [yearId]: err?.response?.data?.message ?? "Unable to send message",
      }));
    } finally {
      setSendingYear((prev) => (prev === yearId ? null : prev));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Teaching History" subtitle="Review your academic year assignments." />
      <div className="flex justify-end">
        <Link to="/teacher/history/operational">
          <Button variant="secondary">Operational History</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingState label="Loading history" />
      ) : error ? (
        <EmptyState title="Unable to load history" description={error} />
      ) : timeline.length === 0 ? (
        <EmptyState title="No history" description="No teaching history records found." />
      ) : (
        <div className="space-y-4">
          {timeline.map((item: any) => {
            const isPreviousYear = item.academicYear.id === previousYearId;
            const actions = isPreviousYear ? (
              <div className="flex items-center gap-2">
                <Link to={`/teacher/analytics?academicYearId=${item.academicYear.id}`}>
                  <Button variant="secondary">Analytics</Button>
                </Link>
                <Link to={`/ranking?academicYearId=${item.academicYear.id}`}>
                  <Button variant="secondary">Ranking</Button>
                </Link>
              </div>
            ) : null;
            return (
            <Card
              key={item.academicYear.id}
              title={item.academicYear.label}
              subtitle={
                item.academicYear.id === activeYearId
                  ? "Current Academic Year"
                  : isPreviousYear
                    ? "Previous Academic Year"
                    : "Archived Year"
              }
              actions={actions}
            >
              <p className="text-sm text-slate-500">Assignments</p>
              <div className="mt-2 space-y-2 text-sm">
                  {item.subjects.map((subject: any, idx: number) => (
                    <div key={`${subject.classId}-${subject.sectionId ?? "all"}-${subject.subjectCode ?? subject.subjectName ?? "subject"}-${idx}`} className="flex items-center justify-between">
                      <span>{subject.className} {subject.sectionName ?? ""}</span>
                      <span className="text-slate-500">{subject.subjectName}</span>
                    </div>
                  ))}
              </div>

              {item.classTeacherAssignments?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Class Teacher Assignments</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {item.classTeacherAssignments.map((assignment: any, idx: number) => (
                      <div key={`${assignment.classId}-${assignment.sectionId ?? "section"}-${idx}`}>
                        {assignment.className} {assignment.sectionName ?? ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.academicYear.id === previousYearId ? (
                <div className="mt-4">
                  <TransitionCountdownCard
                    title="Previous Year Transition"
                    endsAt={transitionMeta?.teacherWindowEndsAt ?? null}
                    allowed={transitionMeta?.canTeacherInteract}
                    expiredLabel="Transition interaction period ended. View only."
                  />
                  {transitionMeta?.canTeacherInteract ? (
                    <div className="mt-3 space-y-2">
                      <Select
                        label="Message Student/Parent"
                        value={selectedContactByYear[item.academicYear.id] ?? ""}
                        onChange={(e) =>
                          setSelectedContactByYear((prev) => ({
                            ...prev,
                            [item.academicYear.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select a contact</option>
                        {(contacts ?? []).map((contact) => (
                          <option key={contact.userId} value={contact.userId}>
                            {contact.name} ({contact.roleType})
                          </option>
                        ))}
                      </Select>
                      <textarea
                        className="w-full rounded-md border border-slate-200 p-2 text-sm"
                        rows={2}
                        value={messageByYear[item.academicYear.id] ?? ""}
                        onChange={(e) =>
                          setMessageByYear((prev) => ({
                            ...prev,
                            [item.academicYear.id]: e.target.value,
                          }))
                        }
                        placeholder="Send a follow-up to your previous class"
                      />
                      {errorByYear[item.academicYear.id] ? (
                        <p className="text-xs text-rose-600">{errorByYear[item.academicYear.id]}</p>
                      ) : null}
                      <Button
                        onClick={() => handleSendMessage(item.academicYear.id)}
                        disabled={
                          sendingYear === item.academicYear.id ||
                          !selectedContactByYear[item.academicYear.id] ||
                          !(messageByYear[item.academicYear.id] ?? "").trim()
                        }
                      >
                        {sendingYear === item.academicYear.id ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2">Interaction Closed — View Only</p>
                  )}
                </div>
              ) : null}
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
