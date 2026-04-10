import { useEffect, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import { listExams } from "../../services/api/exams";
import { getReportCard, getReportCardPdf } from "../../services/api/reportCards";

export default function ReportCardsPage() {
  const { data: exams, loading, error } = useAsync(async () => {
    const res = await listExams({ page: 1, limit: 50 });
    return res?.data ?? res ?? [];
  }, []);

  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [reportCard, setReportCard] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const loadReportCard = async (examId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const card = await getReportCard(examId);
      setReportCard(card);
      try {
        const pdf = await getReportCardPdf(examId, undefined, true);
        setPdfUrl(pdf?.pdfUrl ?? null);
      } catch {
        setPdfUrl(null);
      }
    } catch (err: unknown) {
      setDetailsError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Report card unavailable");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExam) loadReportCard(selectedExam);
  }, [selectedExam]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report Cards" subtitle="Access published report cards" />
      <Card title="Exams">
        {loading ? (
          <LoadingState label="Loading exams" />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : exams?.length ? (
          <Table columns={["Exam", "Term", "Action"]}>
            {exams.map((exam: { id: string; title: string; termNo: number }) => (
              <tr key={exam.id} className="rounded-lg bg-white shadow-soft">
                <td className="px-3 py-3 font-semibold text-ink-800">{exam.title}</td>
                <td className="px-3 py-3">Term {exam.termNo}</td>
                <td className="px-3 py-3">
                  <Button variant="secondary" onClick={() => setSelectedExam(exam.id)}>
                    View Report Card
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No exams" description="No exams available yet." />
        )}
      </Card>
      {selectedExam && (
        <Card title="Report Card Details">
          {detailsLoading ? (
            <LoadingState label="Loading report card" />
          ) : detailsError ? (
            <p className="text-sm text-sunrise-600">{detailsError}</p>
          ) : reportCard ? (
            <div className="space-y-2 text-sm text-ink-600">
              <p>Total Marks: <span className="font-semibold text-ink-800">{reportCard.totalMarks}</span></p>
              <p>Percentage: <span className="font-semibold text-ink-800">{reportCard.percentage}%</span></p>
              <p>Grade: <span className="font-semibold text-ink-800">{reportCard.grade ?? "-"}</span></p>
              {pdfUrl ? (
                <SecureLink
                  fileUrl={pdfUrl}
                  fileName="report-card"
                  className="mt-3 inline-flex items-center rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Download PDF
                </SecureLink>
              ) : (
                <p className="text-xs text-ink-400">PDF is being generated. Please refresh later.</p>
              )}
            </div>
          ) : (
            <EmptyState title="Report card unavailable" description="Report card is not published yet." />
          )}
        </Card>
      )}
    </div>
  );
}
