import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from "recharts";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { listExams } from "../../services/api/exams";
import { getActiveAcademicYear, getAcademicYearTransitionMeta } from "../../services/api/metadata";
import { getTeacherMyClassAnalytics } from "../../services/api/examWorkflow";
import { getClassRanking, getRanking, recomputeRanking } from "../../services/api/ranking";
import { isAdminRole } from "../../utils/role";

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-xl">
        <p className="mb-1 text-sm font-semibold text-slate-800">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}{entry.name.includes('%') ? '%' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function StudentRankPage() {
  const [searchParams] = useSearchParams();
  const queryAcademicYearId = searchParams.get("academicYearId") ?? "";
  const { role } = useAuth();
  const isAdmin = isAdminRole(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";
  const [academicYearId, setAcademicYearId] = useState("");
  const { data: activeYear } = useAsync(getActiveAcademicYear, []);
  const { data: transitionMeta } = useAsync(getAcademicYearTransitionMeta, []);
  const activeYearId = activeYear?.id ?? transitionMeta?.toAcademicYear?.id ?? "";
  const effectiveAcademicYearId = isAdmin ? academicYearId : queryAcademicYearId || activeYearId;

  const { data: exams, loading: loadingExams, error: examsError } = useAsync(async () => {
    const res = await listExams({
      page: 1,
      limit: 50,
      academicYearId: effectiveAcademicYearId || undefined,
    });
    return res?.data ?? res ?? [];
  }, [effectiveAcademicYearId, isAdmin, academicYearId]);

  const { data: classes, loading: loadingClasses, error: classesError } = useAsync(async () => {
    if (!isAdmin) return [];
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    return res.data?.data ?? res.data ?? [];
  }, [isAdmin, academicYearId]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [adminRanking, setAdminRanking] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminRecomputeLoading, setAdminRecomputeLoading] = useState(false);
  const [adminRecomputeMessage, setAdminRecomputeMessage] = useState<string | null>(null);

  const [teacherAnalytics, setTeacherAnalytics] = useState<any>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const [studentRanking, setStudentRanking] = useState<any>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const loadAdminRanking = async () => {
    if (!selectedExamId || !selectedClassId) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const data = await getClassRanking(selectedExamId, selectedClassId);
      setAdminRanking(Array.isArray(data) ? data : data?.items ?? []);
    } catch (err: unknown) {
      setAdminError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to load class ranking"
      );
      setAdminRanking([]);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminRecompute = async () => {
    if (!selectedExamId) return;
    setAdminRecomputeLoading(true);
    setAdminRecomputeMessage(null);
    try {
      await recomputeRanking(selectedExamId);
      setAdminRecomputeMessage("Ranking recompute started. Refresh in a moment.");
      await loadAdminRanking();
    } catch (err: unknown) {
      setAdminRecomputeMessage(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to recompute ranking"
      );
    } finally {
      setAdminRecomputeLoading(false);
    }
  };

  const loadTeacherRanking = async () => {
    if (!selectedExamId) return;
    setTeacherLoading(true);
    setTeacherError(null);
    try {
      const data = await getTeacherMyClassAnalytics({ examId: selectedExamId });
      setTeacherAnalytics(data);
    } catch (err: unknown) {
      setTeacherError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to load section ranking"
      );
      setTeacherAnalytics(null);
    } finally {
      setTeacherLoading(false);
    }
  };

  const loadStudentRanking = async () => {
    if (!selectedExamId) return;
    setStudentLoading(true);
    setStudentError(null);
    try {
      const data = await getRanking(selectedExamId, 1, 1);
      setStudentRanking(data ?? null);
    } catch (err: unknown) {
      setStudentError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Ranking not available"
      );
      setStudentRanking(null);
    } finally {
      setStudentLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedExamId) return;
    if (isAdmin) {
      loadAdminRanking();
    } else if (isTeacher) {
      loadTeacherRanking();
    } else if (isStudent) {
      loadStudentRanking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, selectedClassId, isAdmin, isTeacher, isStudent]);

  useEffect(() => {
    setSelectedExamId("");
    setSelectedClassId("");
    setAdminRanking([]);
    setTeacherAnalytics(null);
    setStudentRanking(null);
  }, [effectiveAcademicYearId, academicYearId, isAdmin]);

  // Derive charts for Admin
  const adminTop10 = useMemo(() => {
    if (!adminRanking?.length) return [];
    return [...adminRanking].sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).slice(0, 10);
  }, [adminRanking]);

  // Derive charts for Teacher
  const teacherTop10 = useMemo(() => {
    if (!teacherAnalytics?.students?.length) return [];
    return [...teacherAnalytics.students].sort((a: any, b: any) => (b.overallPercentage || 0) - (a.overallPercentage || 0)).slice(0, 10);
  }, [teacherAnalytics]);

  const chartColors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#84cc16", "#10b981", "#14b8a6", "#0ea5e9"];

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Student Ranking" subtitle="Performance leaderboards and relative rankings" />

      <Card className="!p-4 bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {isAdmin && (
            <AcademicYearFilter
              value={academicYearId}
              onChange={setAcademicYearId}
              syncQueryKey="academicYearId"
            />
          )}
          <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
            <div className="w-full">
              {loadingExams || (isAdmin && loadingClasses) ? (
                <p className="text-sm text-slate-500 py-2">Loading...</p>
              ) : examsError || (isAdmin && classesError) ? (
                <p className="text-sm text-red-500 py-2">{examsError ?? classesError}</p>
              ) : (
                <Select
                  label="Select Exam"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                >
                  <option value="">-- Choose an Exam --</option>
                  {(exams ?? []).map((exam: any) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {isAdmin && (
              <div className="w-full">
                <Select
                  label="Select Class"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">-- Choose a Class --</option>
                  {(classes ?? []).map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.className}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (isAdmin) return loadAdminRanking();
                if (isTeacher) return loadTeacherRanking();
                if (isStudent) return loadStudentRanking();
                return undefined;
              }}
              disabled={!selectedExamId || (isAdmin && !selectedClassId)}
              className="h-[42px]"
            >
              Refresh
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={handleAdminRecompute}
                disabled={!selectedExamId || adminRecomputeLoading}
                className="h-[42px] bg-slate-900 hover:bg-slate-800"
              >
                {adminRecomputeLoading ? "Recomputing..." : "Recompute"}
              </Button>
            )}
          </div>
        </div>
        {isAdmin && adminRecomputeMessage && (
          <p className="mt-3 text-xs font-semibold text-emerald-600">{adminRecomputeMessage}</p>
        )}
      </Card>

      {/* ADMIN VIEW */}
      {isAdmin && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {adminLoading ? (
            <Card className="flex h-64 items-center justify-center"><LoadingState label="Loading class ranking..." /></Card>
          ) : adminError ? (
            <Card className="border-red-200 bg-red-50"><p className="text-center font-medium text-red-600">{adminError}</p></Card>
          ) : adminRanking?.length ? (
            <>
              {/* TOP 10 GRAPH */}
              <Card title="Top 10 Performers" subtitle="Highest percentages in the class">
                <div className="h-80 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={adminTop10}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fontSize: 11, fill: '#475569' }} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="percentage" name="Score %" radius={[0, 4, 4, 0]} barSize={24}>
                        {adminTop10.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* TABLE */}
              <Card title="Full Class Leaderboard" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-4 w-20 text-center">Rank</th>
                        <th className="px-5 py-4 min-w-[200px]">Student Name</th>
                        <th className="px-5 py-4 text-right">Total Marks</th>
                        <th className="px-5 py-4 text-right">Percentage</th>
                        <th className="px-5 py-4 text-center">School Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminRanking.map((row: any) => (
                        <tr key={row.studentId} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full font-bold
                              ${row.classRank === 1 ? 'bg-amber-100 text-amber-700' :
                                row.classRank === 2 ? 'bg-slate-200 text-slate-700' :
                                  row.classRank === 3 ? 'bg-orange-100 text-orange-800' :
                                    'bg-slate-100 text-slate-500'}`}>
                              {row.classRank ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-800">{row.name ?? row.studentId}</td>
                          <td className="px-5 py-4 text-right font-medium">{row.totalMarks ?? "—"}</td>
                          <td className="px-5 py-4 text-right font-bold text-slate-700">{row.percentage ?? "—"}%</td>
                          <td className="px-5 py-4 text-center font-medium text-slate-500">#{row.schoolRank ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex h-64 items-center justify-center">
              <EmptyState title="No data" description="Ranking appears after results are published. Select an exam and class." />
            </Card>
          )}
        </div>
      )}

      {/* TEACHER VIEW */}
      {isTeacher && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {teacherLoading ? (
            <Card className="flex h-64 items-center justify-center"><LoadingState label="Loading ranking..." /></Card>
          ) : teacherError ? (
            <Card className="border-red-200 bg-red-50"><p className="text-center font-medium text-red-600">{teacherError}</p></Card>
          ) : teacherAnalytics?.students?.length ? (
            <>
              {/* TOP 10 GRAPH */}
              <Card title="Top Section Performers" subtitle="Highest percentages in your section">
                <div className="h-80 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={teacherTop10}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis type="category" dataKey="fullName" axisLine={false} tickLine={false} width={140} tick={{ fontSize: 11, fill: '#475569' }} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="overallPercentage" name="Score %" radius={[0, 4, 4, 0]} barSize={24}>
                        {teacherTop10.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* TABLE */}
              <Card title="Section Leaderboard" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-4 w-20 text-center">Rank</th>
                        <th className="px-5 py-4">Roll</th>
                        <th className="px-5 py-4 min-w-[200px]">Student Name</th>
                        <th className="px-5 py-4 text-right">Overall %</th>
                        <th className="px-5 py-4 text-center">School Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...teacherAnalytics.students].sort((a, b) => (a.sectionRank || 999) - (b.sectionRank || 999)).map((student: any) => (
                        <tr key={student.studentId} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full font-bold
                              ${student.sectionRank === 1 ? 'bg-amber-100 text-amber-700' :
                                student.sectionRank === 2 ? 'bg-slate-200 text-slate-700' :
                                  student.sectionRank === 3 ? 'bg-orange-100 text-orange-800' :
                                    'bg-slate-100 text-slate-500'}`}>
                              {student.sectionRank ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-500">{student.rollNumber ?? "Pending"}</td>
                          <td className="px-5 py-4 font-semibold text-slate-800">{student.fullName ?? "—"}</td>
                          <td className="px-5 py-4 text-right font-bold text-slate-700">{student.overallPercentage ?? "—"}%</td>
                          <td className="px-5 py-4 text-center font-medium text-slate-500">#{student.schoolRank ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex h-64 items-center justify-center">
              <EmptyState title="No data" description="Ranking appears after results are published. Select an exam." />
            </Card>
          )}
        </div>
      )}

      {/* STUDENT VIEW */}
      {isStudent && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {studentLoading ? (
            <Card className="flex h-64 items-center justify-center"><LoadingState label="Loading my ranking..." /></Card>
          ) : studentError ? (
            <Card className="border-red-200 bg-red-50"><p className="text-center font-medium text-red-600">{studentError}</p></Card>
          ) : studentRanking ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 flex flex-col items-center justify-center shadow-sm">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Section Rank</p>
                <p className="mt-2 text-5xl font-black text-indigo-900">#{studentRanking.sectionRank ?? "-"}</p>
                <p className="mt-2 text-xs font-medium text-indigo-500">In your classroom</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 flex flex-col items-center justify-center shadow-sm">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Class Rank</p>
                <p className="mt-2 text-5xl font-black text-emerald-900">#{studentRanking.classRank ?? "-"}</p>
                <p className="mt-2 text-xs font-medium text-emerald-500">Across all sections</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 flex flex-col items-center justify-center shadow-sm">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">School Rank</p>
                <p className="mt-2 text-5xl font-black text-amber-900">#{studentRanking.schoolRank ?? "-"}</p>
                <p className="mt-2 text-xs font-medium text-amber-500">Overall school standing</p>
              </div>
            </div>
          ) : (
            <Card className="flex h-64 items-center justify-center">
              <EmptyState title="No ranking" description="Ranking appears after results are published." />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
