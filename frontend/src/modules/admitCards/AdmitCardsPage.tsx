import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import StatusBadge from "../../components/StatusBadge";
import SecureLink from "../../components/SecureLink";
import { listExams } from "../../services/api/exams";
import { getAdmitCard, getAdmitCardPdf } from "../../services/api/admitCards";
import { useActiveStudent } from "../../hooks/useActiveStudent";

export default function AdmitCardsPage() {
  const { activeStudent, parentStudents, loading: studentLoading } = useActiveStudent();
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudent?.id) setSelectedStudentId(activeStudent.id);
  }, [activeStudent?.id]);

  const examsQuery = useQuery({
    queryKey: ["exams", "list"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  const admitQuery = useQuery({
    queryKey: ["admit-card", selectedExamId, selectedStudentId],
    queryFn: async () => {
      try {
        const card = await getAdmitCard(selectedExamId, selectedStudentId ?? undefined);
        let pdfUrl: string | null = null;
        try {
          const pdf = await getAdmitCardPdf(selectedExamId, selectedStudentId ?? undefined);
          pdfUrl = pdf?.pdfUrl ?? null;
        } catch {
          pdfUrl = null;
        }
        return { card, pdfUrl, notAvailable: false };
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 404 || status === 403) {
          return { card: null, pdfUrl: null, notAvailable: true };
        }
        throw error;
      }
    },
    enabled: Boolean(selectedExamId),
  });

  const selectedExam = exams.find((exam: any) => exam.id === selectedExamId);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Admit Cards" subtitle="Download your exam entry pass when published." />

      <Card title="Select Exam" subtitle="Admit cards unlock after fee payment + registration + admin publish">
        {studentLoading || examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load exams.</p>
        ) : exams.length === 0 ? (
          <EmptyState title="No exams" description="Admit cards will appear once exams are created." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((exam: any) => (
              <button
                key={exam.id}
                onClick={() => setSelectedExamId(exam.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${selectedExamId === exam.id
                  ? "border-blue-400 bg-blue-50/60 shadow-md dark:bg-blue-500/10"
                  : "border-slate-100 bg-white/80 hover:border-blue-200 dark:bg-slate-900/60 dark:border-slate-800"}`}
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{exam.title ?? "Exam"}</p>
                <p className="text-xs text-slate-400">Term {exam.termNo ?? "-"}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      {parentStudents.length > 1 && (
        <Card title="Select Student" subtitle="Download admit card for your child">
          <div className="max-w-md">
            <Select
              label="Student"
              value={selectedStudentId ?? ""}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {parentStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName ?? "Student"}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {selectedExamId && (
        <Card title="Admit Card" subtitle={selectedExam?.title ?? "Exam details"}>
          {admitQuery.isLoading ? (
            <LoadingState label="Loading admit card" />
          ) : admitQuery.isError ? (
            <p className="text-sm text-rose-600">Unable to load admit card.</p>
          ) : admitQuery.data?.notAvailable ? (
            <EmptyState title="Admit card unavailable" description="Admit card not available yet." />
          ) : admitQuery.data?.card ? (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-slate-400">Admit Number</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{admitQuery.data.card.admitCardNumber ?? "--"}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-slate-400">Status</span>
                  <StatusBadge variant={admitQuery.data.card.isLocked ? "warning" : "success"}>
                    {admitQuery.data.card.isLocked ? "Locked" : "Ready"}
                  </StatusBadge>
                </div>
                {admitQuery.data.card.isLocked && (
                  <p className="mt-4 text-xs text-rose-500">{admitQuery.data.card.lockReason ?? "Not eligible"}</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {admitQuery.data.card.isLocked ? (
                  <Button variant="secondary" disabled>Download Disabled</Button>
                ) : admitQuery.data.pdfUrl ? (
                  <SecureLink
                    fileUrl={admitQuery.data.pdfUrl}
                    fileName="admit-card"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white"
                  >
                    Download PDF
                  </SecureLink>
                ) : (
                  <Button variant="secondary" disabled>PDF Generating</Button>
                )}
                <p className="text-xs text-slate-400">
                  {admitQuery.data.card.isLocked
                    ? "Admit card is locked."
                    : admitQuery.data.pdfUrl
                      ? "Admit card is ready for download."
                      : "PDF is generating. Refresh in a moment."}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState title="Admit card unavailable" description="Admit cards will appear once published." />
          )}
        </Card>
      )}
    </div>
  );
}
