import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Cell
} from "recharts";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Input from "../../components/Input";
import { useAsync } from "../../hooks/useAsync";
import { listExams } from "../../services/api/exams";
import { getTeacherMyClassAnalytics } from "../../services/api/examWorkflow";
import { getActiveAcademicYear, getAcademicYearTransitionMeta } from "../../services/api/metadata";

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-xl">
        <p className="mb-1 text-sm font-semibold text-slate-800">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TeacherAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const queryAcademicYearId = searchParams.get("academicYearId") ?? "";
  const { data: activeYear } = useAsync(getActiveAcademicYear, []);
  const { data: transitionMeta } = useAsync(getAcademicYearTransitionMeta, []);
  const activeYearId = activeYear?.id ?? transitionMeta?.toAcademicYear?.id ?? "";
  const effectiveAcademicYearId = queryAcademicYearId || activeYearId;

  const { data: exams, loading: loadingExams, error: examsError } = useAsync(async () => {
    const res = await listExams({
      page: 1,
      limit: 50,
      academicYearId: effectiveAcademicYearId || undefined,
    });
    return res?.data ?? res ?? [];
  }, [effectiveAcademicYearId]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [marksThreshold, setMarksThreshold] = useState("40");
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const handleLoad = async () => {
    setAnalyticsError(null);
    setLoadingAnalytics(true);
    try {
      const data = await getTeacherMyClassAnalytics({
        examId: selectedExamId,
        marksThreshold: Number(marksThreshold),
        attendanceThreshold: Number(attendanceThreshold),
      });
      setAnalytics(data);
    } catch (err: unknown) {
      setAnalyticsError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to load analytics"
      );
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (!selectedExamId) return;
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  useEffect(() => {
    setSelectedExamId("");
    setAnalytics(null);
  }, [effectiveAcademicYearId]);

  // Derived Statistics
  const stats = useMemo(() => {
    if (!analytics || !analytics.students || analytics.students.length === 0) return null;

    const students = analytics.students;
    const totalStudents = students.length;

    // Overall Average
    const sumOverall = students.reduce((acc: number, curr: any) => acc + (curr.overallPercentage || 0), 0);
    const avgOverall = (sumOverall / totalStudents).toFixed(1);

    // Weak arrays
    const weakMarksCount = students.filter((s: any) => s.weakMarks).length;
    const weakAttendanceCount = students.filter((s: any) => s.weakAttendance).length;

    // Highest scorer
    const highestScorer = students.reduce((prev: any, current: any) =>
      (prev.overallPercentage > current.overallPercentage) ? prev : current
    );

    // Subject Toppers
    const subjectToppers: { subjectName: string; topperName: string; score: number }[] = [];
    if (analytics.subjects) {
      analytics.subjects.forEach((subject: any) => {
        let bestStudent = "";
        let bestScore = -1;
        students.forEach((student: any) => {
          const markItem = student.subjectMarks?.find((m: any) => m.examSubjectId === subject.examSubjectId);
          if (markItem && markItem.marksObtained > bestScore) {
            bestScore = markItem.marksObtained;
            bestStudent = student.fullName;
          }
        });
        if (bestScore >= 0) {
          subjectToppers.push({ subjectName: subject.subjectName, topperName: bestStudent, score: bestScore });
        }
      });
    }

    return {
      totalStudents,
      avgOverall,
      weakMarksCount,
      weakAttendanceCount,
      highestScorerName: highestScorer?.fullName || "—",
      highestScore: highestScorer?.overallPercentage || 0,
      subjectToppers
    };
  }, [analytics]);

  const handleDownloadCSV = () => {
    if (!analytics || !analytics.students) return;

    const subjects = analytics.subjects || [];
    const headers = ["Rank", "Roll No", "Student Name", ...subjects.map((s: any) => s.subjectName), "Overall %", "Attendance %", "Status"];

    const rows = analytics.students.map((student: any) => {
      const subjectMarks = subjects.map((sub: any) => {
        const markItem = student.subjectMarks?.find((m: any) => m.examSubjectId === sub.examSubjectId);
        return markItem ? markItem.marksObtained : "—";
      });

      return [
        student.sectionRank ?? "—",
        student.rollNumber ?? "Pending",
        student.fullName,
        ...subjectMarks,
        `${student.overallPercentage}%`,
        `${student.attendancePercentage}%`,
        student.hasFailedSubject ? "Fail" : "Pass"
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map(value => `"${value}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Analytics_${analytics.exam?.title || "Report"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartColors = ["#6366f1", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Student Analytics" subtitle="Comprehensive performance and attendance insights" />

      {/* FILTER BAR - Made more compact & inline */}
      <Card className="!p-4 bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            {loadingExams ? (
              <p className="text-sm text-slate-500 py-2">Loading exams...</p>
            ) : examsError ? (
              <p className="text-sm text-red-500 py-2">{examsError}</p>
            ) : (
              <Select
                label="Select Exam Snapshot"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full"
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

          <div className="w-full sm:w-32">
            <Input
              label="Failing Mark %"
              type="number"
              value={marksThreshold}
              onChange={(e) => setMarksThreshold(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-40">
            <Input
              label="Low Attendance %"
              type="number"
              value={attendanceThreshold}
              onChange={(e) => setAttendanceThreshold(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto">
            <Button
              variant="primary"
              onClick={handleLoad}
              disabled={!selectedExamId || loadingAnalytics}
              className="w-full sm:w-auto h-[42px] bg-slate-900 hover:bg-slate-800"
            >
              {loadingAnalytics ? "Loading..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </Card>

      {loadingAnalytics && (
        <Card className="flex h-64 items-center justify-center">
          <LoadingState label="Analyzing data..." />
        </Card>
      )}

      {analyticsError && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-center font-medium text-red-600">{analyticsError}</p>
        </Card>
      )}

      {!loadingAnalytics && !analyticsError && !analytics && (
        <Card className="flex h-64 items-center justify-center">
          <EmptyState title="No analytics" description="Select an exam to view detailed insights." />
        </Card>
      )}

      {/* RENDER STATS & CHARTS IF DATA EXISTS */}
      {!loadingAnalytics && !analyticsError && analytics && (
        <div className="flex flex-col gap-6 animate-fade-in">

          {/* STAT CARDS */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Class Average</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{stats.avgOverall}%</p>
                <p className="mt-1 text-xs font-medium text-emerald-600">Across all subjects</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Highest Scorer</p>
                <p className="mt-2 text-xl font-bold text-slate-900 truncate">{stats.highestScorerName}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Scored <span className="text-slate-800 font-bold">{stats.highestScore}%</span> overall</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">At-Risk (Grades)</p>
                <p className="mt-2 text-3xl font-black text-orange-700">{stats.weakMarksCount}</p>
                <p className="mt-1 text-xs font-medium text-orange-600">Students below {marksThreshold}%</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">At-Risk (Attendance)</p>
                <p className="mt-2 text-3xl font-black text-rose-700">{stats.weakAttendanceCount}</p>
                <p className="mt-1 text-xs font-medium text-rose-600">Students below {attendanceThreshold}%</p>
              </div>
            </div>
          )}

          {/* SUBJECT TOPPERS */}
          {stats?.subjectToppers && stats.subjectToppers.length > 0 && (
            <Card title="Subject Toppers" subtitle="Highest scores per subject">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {stats.subjectToppers.map((topper, i) => (
                  <div key={i} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-all hover:bg-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{topper.subjectName}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 truncate" title={topper.topperName}>{topper.topperName}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-1">Score: {topper.score}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CHARTS GRID */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Subject Average Chart */}
            <Card title="Subject Performance" subtitle="Average marks by subject">
              {analytics.subjects?.length ? (
                <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="subjectName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="average" name="Average %" radius={[4, 4, 0, 0]}>
                        {analytics.subjects.map((_subject: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10"><EmptyState title="No subject data" /></div>
              )}
            </Card>

            {/* Top Students Chart */}
            <Card title="Top Students" subtitle="Highest overall percentages">
              {analytics.students?.length ? (
                <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...analytics.students].sort((a, b) => (b.overallPercentage || 0) - (a.overallPercentage || 0)).slice(0, 5)}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis type="category" dataKey="fullName" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 11, fill: '#475569' }} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="overallPercentage" name="Overall %" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10"><EmptyState title="No student data" /></div>
              )}
            </Card>

          </div>

          {/* DETAILED STUDENT TABLE */}
          <Card
            title="Student Insights"
            className="overflow-hidden"
            actions={
              <Button
                variant="secondary"
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 h-9"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </Button>
            }
          >
            {analytics.students?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">S.No.</th>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Roll No</th>
                      <th className="px-4 py-3 min-w-[150px]">Student Name</th>
                      {analytics.subjects?.map((sub: any) => (
                        <th key={sub.examSubjectId} className="px-4 py-3 text-right whitespace-nowrap">
                          {sub.subjectName}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Overall %</th>
                      <th className="px-4 py-3 text-right">Attendance %</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...analytics.students].sort((a, b) => (a.sectionRank || 999) - (b.sectionRank || 999)).map((student: any, i: number) => {
                      return (
                        <tr key={student.studentId} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-slate-500 font-medium">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            #{student.sectionRank ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{student.rollNumber ?? "Pending"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{student.fullName}</td>
                          {analytics.subjects?.map((sub: any) => {
                            const markItem = student.subjectMarks?.find((m: any) => m.examSubjectId === sub.examSubjectId);
                            const val = markItem ? markItem.marksObtained : "—";
                            const isFail = markItem ? markItem.isFail : false;
                            return (
                              <td key={sub.examSubjectId} className="px-4 py-3 text-right text-slate-600 font-medium whitespace-nowrap">
                                <span className={isFail ? "text-red-600 font-bold" : ""}>{val}</span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                            <span className={student.weakMarks ? "text-red-600" : ""}>{student.overallPercentage}%</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            <span className={student.weakAttendance ? "text-orange-600" : ""}>{student.attendancePercentage}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {student.hasFailedSubject ? (
                              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                                Fail
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Pass
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10"><EmptyState title="No student data" /></div>
            )}
          </Card>

        </div>
      )}
    </div>
  );
}
