import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "../../components/Card";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { listExams, listExamRegistrationsAdmin } from "../../services/api/exams";
import { listLateRecords } from "../../services/api/fee";

export default function ExamRegistrationsAdminPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  const examsQuery = useQuery({
    queryKey: ["exams", "list", academicYearId],
    queryFn: () => listExams({ page: 1, limit: 100, academicYearId: academicYearId || undefined }),
  });

  const registrationsQuery = useQuery({
    queryKey: ["exam-registrations-admin", selectedExamId],
    queryFn: () => listExamRegistrationsAdmin(selectedExamId),
    enabled: Boolean(selectedExamId),
  });

  const feeIssuedQuery = useQuery({
    queryKey: ["fee-issued-count", academicYearId],
    queryFn: () => listLateRecords({ academicYearId: academicYearId || undefined }),
  });

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  const registrationSummary = useMemo(() => {
    const records = registrationsQuery.data ?? [];
    const total = records.length;
    const statusCounts = records.reduce((acc: Record<string, number>, item: any) => {
      const key = item.status ?? "UNKNOWN";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const totalFeeIssued = feeIssuedQuery.data ? feeIssuedQuery.data.length : 0;
    const notRegistered = Math.max(totalFeeIssued - total, 0);
    return { total, statusCounts, totalFeeIssued, notRegistered };
  }, [registrationsQuery.data, feeIssuedQuery.data]);

  useEffect(() => {
    setSelectedExamId("");
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Exam Registrations" subtitle="View students registered for exams." />
      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
      />

      <Card title="Select Exam" subtitle="Choose an exam to view registrations">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : (
          <div className="max-w-md">
            <Select
              label="Exam"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              <option value="">Select exam</option>
              {exams.map((exam: any) => (
                <option key={exam.id} value={exam.id}>{exam.title ?? "Exam"}</option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <Card title="Registered Students" subtitle="Live registration list">
        {!selectedExamId ? (
          <p className="text-sm text-slate-500">Select an exam to see registrations.</p>
        ) : registrationsQuery.isLoading ? (
          <LoadingState label="Loading registrations" />
        ) : registrationsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load registrations.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-slate-400">Fee Issued</p>
                <p className="mt-2 text-xl font-extrabold text-slate-900">{registrationSummary.totalFeeIssued}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-slate-400">Registered</p>
                <p className="mt-2 text-xl font-extrabold text-slate-900">{registrationSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-slate-400">Not Registered</p>
                <p className="mt-2 text-xl font-extrabold text-slate-900">{registrationSummary.notRegistered}</p>
              </div>
              {(Object.entries(registrationSummary.statusCounts) as Array<[string, number]>).map(([status, count]) => (
                <div key={status} className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{status}</p>
                  <p className="mt-2 text-xl font-extrabold text-slate-900">{count}</p>
                </div>
              ))}
            </div>
            {registrationsQuery.data && registrationsQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Reg No.</th>
                      <th className="py-2 pr-4">Class</th>
                      <th className="py-2 pr-4">Section</th>
                      <th className="py-2 pr-4">Roll</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {registrationsQuery.data.map((item: any) => (
                      <tr key={`${item.examId}-${item.studentId}`} className="border-t border-slate-100">
                        <td className="py-3 pr-4 font-semibold">{item.studentName ?? item.studentId}</td>
                        <td className="py-3 pr-4">{item.registrationNumber ?? "—"}</td>
                        <td className="py-3 pr-4">{item.className ?? "—"}</td>
                        <td className="py-3 pr-4">{item.sectionName ?? "—"}</td>
                        <td className="py-3 pr-4">{item.rollNumber ?? "Pending"}</td>
                        <td className="py-3 pr-4">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No registrations found.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
