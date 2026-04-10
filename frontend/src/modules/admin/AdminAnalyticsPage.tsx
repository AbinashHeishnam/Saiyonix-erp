import { useEffect, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Table from "../../components/Table";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { listExams } from "../../services/api/exams";
import { getClassRanking, recomputeRanking } from "../../services/api/ranking";

export default function AdminAnalyticsPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const { data: exams, loading: loadingExams, error: examsError } = useAsync(async () => {
    const res = await listExams({ page: 1, limit: 50, academicYearId: academicYearId || undefined });
    return res?.data ?? res ?? [];
  }, [academicYearId]);

  const { data: classes, loading: loadingClasses, error: classesError } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    return res.data?.data ?? res.data ?? [];
  }, [academicYearId]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [ranking, setRanking] = useState<any[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [recomputeMessage, setRecomputeMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExamId("");
    setSelectedClassId("");
    setRanking([]);
  }, [academicYearId]);

  const loadRanking = async () => {
    if (!selectedExamId || !selectedClassId) return;
    setLoadingRanking(true);
    setRankingError(null);
    try {
      const data = await getClassRanking(selectedExamId, selectedClassId);
      setRanking(Array.isArray(data) ? data : data?.items ?? []);
    } catch (err: unknown) {
      setRankingError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to load class ranking"
      );
      setRanking([]);
    } finally {
      setLoadingRanking(false);
    }
  };


  const handleRecompute = async () => {
    if (!selectedExamId) return;
    setRecomputeLoading(true);
    setRecomputeMessage(null);
    try {
      await recomputeRanking(selectedExamId);
      setRecomputeMessage("Ranking recompute started. Refresh in a moment.");
      await loadRanking();
    } catch (err: unknown) {
      setRecomputeMessage(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to recompute ranking"
      );
    } finally {
      setRecomputeLoading(false);
    }
  };

  useEffect(() => {
    loadRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, selectedClassId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics & Reports" subtitle="Class ranking and exam insights" />

      <Card title="Filters">
        {(loadingExams || loadingClasses) ? (
          <LoadingState label="Loading filters" />
        ) : (examsError || classesError) ? (
          <p className="text-sm text-sunrise-600">{examsError ?? classesError}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <AcademicYearFilter
              value={academicYearId}
              onChange={setAcademicYearId}
              syncQueryKey="academicYearId"
            />
            <Select
              label="Exam"
              value={selectedExamId}
              onChange={(event) => setSelectedExamId(event.target.value)}
            >
              <option value="">Select exam</option>
              {(exams ?? []).map((exam: any) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </Select>
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">Select class</option>
              {(classes ?? []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.className}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={loadRanking}
                disabled={!selectedExamId || !selectedClassId}
              >
                Refresh
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={handleRecompute}
                disabled={!selectedExamId || recomputeLoading}
              >
                {recomputeLoading ? "Recomputing..." : "Recompute Ranking"}
              </Button>
            </div>
          </div>
        )}
        {recomputeMessage && (
          <p className="mt-3 text-xs text-ink-500">{recomputeMessage}</p>
        )}
      </Card>

      <Card title="Class Ranking">
        {loadingRanking ? (
          <LoadingState label="Loading ranking" />
        ) : rankingError ? (
          <p className="text-sm text-sunrise-600">{rankingError}</p>
        ) : ranking?.length ? (
          <Table columns={["Student", "Total Marks", "Percentage", "Rank"]}>
            {ranking.map((row: any) => (
              <tr key={row.studentId} className="rounded-lg bg-white shadow-soft">
                <td className="px-3 py-3">{row.name ?? row.studentId}</td>
                <td className="px-3 py-3">{row.totalMarks ?? "—"}</td>
                <td className="px-3 py-3">{row.percentage ?? "—"}</td>
                <td className="px-3 py-3">{row.rank ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No data" description="Select an exam and class to view ranking." />
        )}
      </Card>

    </div>
  );
}
