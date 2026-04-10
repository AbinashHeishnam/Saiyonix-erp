import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import Select from "../../components/Select";
import { listExams, listExamRegistrations, registerForExam } from "../../services/api/exams";
import { getStudentFeeStatus } from "../../services/api/fee";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import { toastUtils } from "../../utils/toast";

export default function ExamRegistrationPage() {
  const { activeStudent, parentStudents, loading: studentLoading } = useActiveStudent();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);

  useEffect(() => {
    if (activeStudent?.id) setSelectedStudentId(activeStudent.id);
  }, [activeStudent?.id]);

  const examsQuery = useQuery({
    queryKey: ["exams", "list"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const feeQuery = useQuery({
    queryKey: ["fee-status", selectedStudentId],
    queryFn: () => getStudentFeeStatus(selectedStudentId as string),
    enabled: Boolean(selectedStudentId),
  });

  const feeStatus = feeQuery.data?.status ?? "NOT_PUBLISHED";
  const isFeePaid = feeStatus === "PAID";
  const isNotPublished = feeStatus === "NOT_PUBLISHED";

  const registerMutation = useMutation({
    mutationFn: async (examId: string) => {
      return registerForExam({ examId, studentId: selectedStudentId ?? undefined });
    },
    onSuccess: (_data, examId) => {
      toastUtils.success("Exam registration successful");
      setRegisteredIds((prev) => (prev.includes(examId) ? prev : [...prev, examId]));
    },
    onError: (err: any) => {
      toastUtils.error(err?.response?.data?.message ?? err?.message ?? "Registration failed");
    },
  });

  const registrationsQuery = useQuery({
    queryKey: ["exam-registrations", selectedStudentId],
    queryFn: () => listExamRegistrations(selectedStudentId ?? undefined),
    enabled: Boolean(selectedStudentId),
  });

  useEffect(() => {
    if (registrationsQuery.data) {
      const ids = registrationsQuery.data.map((row) => row.examId);
      setRegisteredIds(ids);
    }
  }, [registrationsQuery.data]);

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Exam Registration"
        subtitle="Register only after full fee payment is confirmed."
      />

      <Card title="Eligibility" subtitle="Live status from fee and publish controls">
        {studentLoading || feeQuery.isLoading ? (
          <LoadingState label="Checking eligibility" />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              Fee Status
            </div>
            <StatusBadge variant={isFeePaid ? "success" : isNotPublished ? "neutral" : "warning"}>
              {isFeePaid ? "PAID" : feeStatus}
            </StatusBadge>
            {isNotPublished ? (
              <p className="text-xs text-rose-500">Fee not available yet.</p>
            ) : !isFeePaid ? (
              <p className="text-xs text-rose-500">Pay fees to unlock registration.</p>
            ) : null}
          </div>
        )}
      </Card>

      {parentStudents.length > 1 && (
        <Card title="Select Student" subtitle="Register for your child">
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

      <Card title="Available Exams" subtitle="Register to unlock admit cards">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load exams.</p>
        ) : exams.length === 0 ? (
          <p className="text-sm text-slate-500">No exams available at the moment.</p>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam: any) => {
              const registered = registeredIds.includes(exam.id);
              return (
                <div key={exam.id} className="rounded-2xl border border-slate-100 bg-white/70 p-5 shadow-sm dark:bg-slate-900/60 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{exam.title ?? exam.name ?? "Exam"}</p>
                      <p className="text-xs text-slate-400">{exam.type ?? "Term"} • Term {exam.termNo ?? "-"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge variant={exam.isPublished ? "success" : "neutral"} dot>
                        {exam.isPublished ? "Published" : "Not Published"}
                      </StatusBadge>
                      {registered && <StatusBadge variant="success" dot>Registered</StatusBadge>}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      disabled={!isFeePaid || registerMutation.isPending || registered}
                      onClick={() => registerMutation.mutate(exam.id)}
                    >
                      {registered ? "Registered" : isFeePaid ? "Register" : isNotPublished ? "Fee Not Available" : "Fee Pending"}
                    </Button>
                    {!isFeePaid && !isNotPublished && (
                      <span className="text-xs text-rose-500">Complete payment to register.</span>
                    )}
                    {isNotPublished && (
                      <span className="text-xs text-rose-500">Fee not available yet.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
