import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import Select from "../../components/Select";
import Input from "../../components/Input";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { listExams } from "../../services/api/exams";
import { getReportCardPdf } from "../../services/api/reportCards";
import { getRanking } from "../../services/api/ranking";
import { downloadSecureFile } from "../../utils/secureFile";
import { toastUtils } from "../../utils/toast";
import {
  getExamResultStatus,
  publishExamResult,
  getExamResultMe,
  requestResultRecheck,
  listResultRecheckComplaints,
} from "../../services/api/examWorkflow";
import { isAdminRole } from "../../utils/role";
import { StudentAnalyticsDashboard } from "../analytics/StudentAnalyticsDashboard";

export default function ResultsPage() {
  const { role } = useAuth();
  const isAdmin = isAdminRole(role);

  const { data: exams, loading, error } = useAsync(async () => {
    const res = await listExams({ page: 1, limit: 50 });
    return res?.data ?? res ?? [];
  }, []);

  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsStudentId, setAnalyticsStudentId] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [ranking, setRanking] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [recheckSubjectId, setRecheckSubjectId] = useState("");
  const [recheckReason, setRecheckReason] = useState("");
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);

  const { data: complaints } = useAsync(async () => {
    if (!isAdmin) return [];
    return await listResultRecheckComplaints();
  }, [isAdmin]);

  const loadAdminStatus = async (examId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const statusRes = await getExamResultStatus(examId);
      setStatusData(statusRes);
      try {
        const rankRes = await getRanking(examId, 1, 100);
        setRanking(rankRes);
      } catch {
        setRanking(null);
      }
    } catch (err: unknown) {
      setDetailsError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Status unavailable");
    } finally {
      setDetailsLoading(false);
    }
  };

  const loadStudentResult = async (examId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const resultRes = await getExamResultMe(examId);
      setResult(resultRes);
      try {
        await getReportCardPdf(examId, undefined, true);
      } catch {
        // ignore if PDF is not ready
      }
    } catch (err: unknown) {
      setDetailsError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Results not available");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedExam) return;
    if (isAdmin) {
      loadAdminStatus(selectedExam);
    } else {
      loadStudentResult(selectedExam);
    }
  }, [selectedExam, isAdmin]);

  const handlePublish = async (examId: string) => {
    setPublishLoading(true);
    setPublishMessage(null);
    try {
      await publishExamResult(examId);
      await loadAdminStatus(examId);
      const message = "Result published successfully.";
      setPublishMessage(message);
      toastUtils.success(message);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to publish result";
      setPublishMessage(message);
      toastUtils.error(message);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleRecheck = async () => {
    if (!selectedExam || !recheckSubjectId || !recheckReason.trim()) {
      setRecheckMessage("Select a subject and enter a reason.");
      return;
    }
    setRecheckMessage(null);
    await requestResultRecheck({
      examId: selectedExam,
      subjectId: recheckSubjectId,
      reason: recheckReason,
    });
    setRecheckReason("");
    setRecheckSubjectId("");
    setRecheckMessage("Recheck request submitted.");
  };

  const handleDownloadReport = async () => {
    if (!selectedExam) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdf = await getReportCardPdf(selectedExam, undefined, true);
      const url = pdf?.pdfUrl ?? null;
      if (url) {
        await downloadSecureFile(url);
      } else {
        setPdfError("PDF is being generated. Please try again in a moment.");
      }
    } catch (err: unknown) {
      setPdfError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to generate report card PDF"
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const subjectOptions = useMemo<Array<{ id: string; label: string }>>(() => {
    if (!result?.subjects) return [] as Array<{ id: string; label: string }>;
    return result.subjects.map((subject: any) => ({
      id: subject.subjectId,
      label: subject.subjectName ?? subject.subjectId,
    }));
  }, [result]);

  const handleShowAnalytics = (studentId?: string) => {
    setAnalyticsStudentId(studentId || "me");
    setShowAnalytics(true);
  };

  if (showAnalytics && analyticsStudentId && selectedExam) {
    return (
      <StudentAnalyticsDashboard
        studentId={analyticsStudentId}
        examId={selectedExam}
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results" subtitle="Exam results and publishing" />

      <Card title="Exams">
        {loading ? (
          <LoadingState label="Loading exams" />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : exams?.length ? (
          <Table columns={["Exam", "Term", "Actions"]}>
            {exams.map((exam: { id: string; title: string; termNo: number }) => (
              <tr key={exam.id} className="rounded-lg bg-white shadow-soft">
                <td className="px-3 py-3 font-semibold text-ink-800">{exam.title}</td>
                <td className="px-3 py-3">Term {exam.termNo}</td>
                <td className="px-3 py-3">
                  <Button variant="secondary" onClick={() => setSelectedExam(exam.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No exams" description="No exams available yet." />
        )}
      </Card>

      {selectedExam && isAdmin && (
        <Card title="Result Submission Status">
          {detailsLoading ? (
            <LoadingState label="Loading status" />
          ) : detailsError ? (
            <p className="text-sm text-sunrise-600">{detailsError}</p>
          ) : statusData?.items?.length ? (
            <>
              {statusData.publishSummary && (
                <div className="mb-4 rounded-2xl border border-ink-100 bg-ink-50/60 px-4 py-3 text-xs text-ink-600">
                  <div className="flex flex-wrap gap-4">
                    <span>
                      <strong>Last Published:</strong>{" "}
                      {statusData.publishSummary.publishedAt
                        ? new Date(statusData.publishSummary.publishedAt).toLocaleString()
                        : "—"}
                    </span>
                    <span>
                      <strong>Published Records:</strong>{" "}
                      {statusData.publishSummary.publishedCount ?? 0}/{statusData.publishSummary.totalCount ?? 0}
                    </span>
                  </div>
                </div>
              )}
              <Table columns={["Class", "Subject", "Section Status"]}>
                {(() => {
                  const grouped = new Map<string, {
                    className: string;
                    subjectName: string;
                    sections: Array<{
                      sectionName: string;
                      classTeacher: string | null;
                      status: string;
                      submittedBy: string | null;
                      submittedAt: string | null;
                    }>;
                  }>();

                  (statusData.items ?? []).forEach((row: any) => {
                    const key = `${row.classId ?? ""}:${row.subjectId ?? ""}`;
                    if (!grouped.has(key)) {
                      grouped.set(key, {
                        className: row.className ?? "—",
                        subjectName: row.subjectName ?? "—",
                        sections: [],
                      });
                    }
                    grouped.get(key)?.sections.push({
                      sectionName: row.sectionName ?? "—",
                      classTeacher: row.classTeacher ?? null,
                      status: row.status ?? "PENDING",
                      submittedBy: row.submittedBy ?? null,
                      submittedAt: row.submittedAt ?? null,
                    });
                  });

                  return Array.from(grouped.values()).map((row, idx) => (
                    <tr key={`${row.className}-${row.subjectName}-${idx}`} className="rounded-lg bg-white shadow-soft">
                      <td className="px-3 py-3">{row.className}</td>
                      <td className="px-3 py-3">{row.subjectName}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.sections.map((sec) => (
                            <div
                              key={`${row.subjectName}-${sec.sectionName}`}
                              className="rounded-xl border border-ink-100 bg-white px-2.5 py-1 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{sec.sectionName}</span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    sec.status === "SUBMITTED"
                                      ? "bg-jade-100 text-jade-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {sec.status === "SUBMITTED" ? "Submitted" : "Pending"}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] text-ink-500">
                                Teacher: {sec.classTeacher ?? "—"}
                              </div>
                              <div className="text-[10px] text-ink-500">
                                {sec.submittedBy
                                  ? `By ${sec.submittedBy} • ${new Date(sec.submittedAt ?? "").toLocaleString()}`
                                  : "Not submitted"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </Table>
              <div className="mt-4">
                {publishMessage && (
                  <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {publishMessage}
                  </div>
                )}
                <Button onClick={() => handlePublish(selectedExam)} loading={publishLoading}>
                  Publish Result
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="No status" description="No subjects found for this exam." />
          )}
        </Card>
      )}

      {selectedExam && !isAdmin && (
        <Card title="Result Details">
          {detailsLoading ? (
            <LoadingState label="Loading results" />
          ) : detailsError ? (
            <p className="text-sm text-sunrise-600">{detailsError}</p>
          ) : result ? (
            <div className="space-y-4 text-sm text-ink-600">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>Total Marks: <span className="font-semibold text-ink-800">{result.totalMarks}</span></div>
                <div>Percentage: <span className="font-semibold text-ink-800">{result.percentage}%</span></div>
                <div>Section Rank: <span className="font-semibold text-ink-800">{result.sectionRank ?? "-"}</span></div>
                <div>Class Rank: <span className="font-semibold text-ink-800">{result.classRank ?? "-"}</span></div>
                <div>School Rank: <span className="font-semibold text-ink-800">{result.schoolRank ?? "-"}</span></div>
              </div>

              {result.subjects?.length ? (
                <Table columns={["Subject", "Marks", "Status"]}>
                  {result.subjects.map((subject: any) => (
                    <tr key={subject.subjectId} className="rounded-lg bg-white shadow-soft">
                      <td className="px-3 py-3">{subject.subjectName ?? subject.subjectId}</td>
                      <td className="px-3 py-3">{subject.marksObtained}/{subject.maxMarks}</td>
                      <td className="px-3 py-3">{subject.status}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <EmptyState title="No subjects" description="No subject marks found." />
              )}

              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={handleDownloadReport} disabled={pdfLoading}>
                  {pdfLoading ? "Preparing PDF..." : "Download Report Card"}
                </Button>
                <Button onClick={() => handleShowAnalytics(result?.studentId ?? "me")}>
                  View Analytics
                </Button>
                {pdfError && <p className="text-xs text-ink-400">{pdfError}</p>}
              </div>

              <div className="rounded-xl border border-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-800">Request Recheck</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Select
                    label="Subject"
                    value={recheckSubjectId}
                    onChange={(event) => setRecheckSubjectId(event.target.value)}
                  >
                    <option value="">Select subject</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Reason"
                    value={recheckReason}
                    onChange={(event) => setRecheckReason(event.target.value)}
                    placeholder="Reason for recheck"
                  />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="secondary" onClick={handleRecheck}>Submit Recheck</Button>
                  {recheckMessage && <p className="text-xs text-ink-500">{recheckMessage}</p>}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="Results unavailable" description="Results are not published yet." />
          )}
        </Card>
      )}

      {isAdmin && (
        <Card title="Recheck Requests">
          {complaints?.length ? (
            <Table columns={["Student", "Subject", "Reason", "Status"]}>
              {complaints.map((item: any) => (
                <tr key={item.id} className="rounded-lg bg-white shadow-soft">
                  <td className="px-3 py-3">{item.student?.fullName ?? "—"}</td>
                  <td className="px-3 py-3">{item.subject}</td>
                  <td className="px-3 py-3">{item.description}</td>
                  <td className="px-3 py-3">{item.status}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No recheck requests" description="No result recheck complaints yet." />
          )}
        </Card>
      )}

      {isAdmin && ranking?.items?.length ? (
        <Card title="Ranking Snapshot">
          <Table columns={["Student", "Class Rank", "Section Rank", "School Rank", "Actions"]}>
            {ranking.items.map((row: any) => (
              <tr key={row.studentId} className="rounded-lg bg-white shadow-soft">
                <td className="px-3 py-3">{row.student?.fullName ?? row.studentId}</td>
                <td className="px-3 py-3">{row.classRank ?? "—"}</td>
                <td className="px-3 py-3">{row.sectionRank ?? "—"}</td>
                <td className="px-3 py-3">{row.schoolRank ?? "—"}</td>
                <td className="px-3 py-3">
                  <Button variant="secondary" onClick={() => handleShowAnalytics(row.studentId)}>
                    Analytics
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
