import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import api, { safeApiCall } from "../../services/api/client";
import { listExams } from "../../services/api/exams";
import { listAdmitCardControls, setAdmitCardPublishStatus } from "../../services/api/admitCards";
import AcademicYearFilter from "../../components/AcademicYearFilter";

export default function AdmitCardAdminPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [publishExamId, setPublishExamId] = useState("");

  const examsQuery = useQuery({
    queryKey: ["exams", "list", academicYearId],
    queryFn: () => listExams({ page: 1, limit: 100, academicYearId: academicYearId || undefined }),
  });

  const controlsQuery = useQuery({
    queryKey: ["admit-card-controls"],
    queryFn: () => listAdmitCardControls(),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!publishExamId) throw new Error("Select an exam to publish");
      return await safeApiCall(() => api.post("/admin/admit-card/publish", { examId: publishExamId }), {
        loading: "Publishing admit cards...",
        success: "Admit cards published",
      });
    },
    onSuccess: () => {
      controlsQuery.refetch();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (payload: { examId: string; isPublished: boolean }) => {
      return await safeApiCall(() => setAdmitCardPublishStatus(payload), {
        loading: payload.isPublished ? "Activating admit cards..." : "Deactivating admit cards...",
        success: payload.isPublished ? "Admit cards activated" : "Admit cards deactivated",
      });
    },
    onSuccess: () => {
      controlsQuery.refetch();
    },
  });

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  useEffect(() => {
    setPublishExamId("");
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Admit Card Publish" subtitle="Publish admit cards and track publish records." />
      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Publish Admit Cards" subtitle="Enable admit cards for registered students">
          {examsQuery.isLoading ? (
            <LoadingState label="Loading exams" />
          ) : (
            <div className="flex flex-col gap-4">
              <Select
                label="Exam"
                value={publishExamId}
                onChange={(e) => setPublishExamId(e.target.value)}
              >
                <option value="">Select exam</option>
                {exams.map((exam: any) => (
                  <option key={exam.id} value={exam.id}>{exam.title ?? "Exam"}</option>
                ))}
              </Select>
              <Button loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                Publish Admit Cards
              </Button>
            </div>
          )}
        </Card>

        <Card title="Publish Records" subtitle="Latest admit card publish history">
          {controlsQuery.isLoading ? (
            <LoadingState label="Loading publish records" />
          ) : controlsQuery.isError ? (
            <p className="text-sm text-rose-600">Unable to load publish records.</p>
          ) : controlsQuery.data && controlsQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Exam</th>
                    <th className="py-2 pr-4">Term</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Updated</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {controlsQuery.data.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-semibold">{item.title ?? item.examId}</td>
                      <td className="py-3 pr-4">{item.termNo ?? "—"}</td>
                      <td className="py-3 pr-4">{item.isPublished ? "PUBLISHED" : "DRAFT"}</td>
                      <td className="py-3 pr-4">
                        {new Date(item.updatedAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 pr-4">
                        <Button
                          variant={item.isPublished ? "ghost" : "secondary"}
                          loading={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({
                              examId: item.examId,
                              isPublished: !item.isPublished,
                            })
                          }
                        >
                          {item.isPublished ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No publish records found.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
