import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { getStudentAnalytics, StudentAnalyticsResponse } from "../../services/api/analytics";

interface StudentAnalyticsDashboardProps {
    studentId: string;
    examId?: string;
    onClose?: () => void;
}

export function StudentAnalyticsDashboard({ studentId, examId, onClose }: StudentAnalyticsDashboardProps) {
    const [data, setData] = useState<StudentAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const analytics = await getStudentAnalytics(studentId, examId);
                setData(analytics);
            } catch (err: any) {
                setError(err.response?.data?.message || "Failed to load analytics");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [studentId, examId]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-500 font-medium">Crunching analytics...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-red-500 mb-2">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-800">Analytics Unavailable</h3>
                <p className="text-slate-500 mt-1">{error}</p>
                {onClose && (
                    <button onClick={onClose} className="mt-6 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                        Go Back
                    </button>
                )}
            </div>
        );
    }

    const { studentInfo, overall, subjectWise, trends, classStats, attendance } = data;

    // Pass vs Fail for Donut
    const passedSubjects = subjectWise.filter((s: any) => s.pass).length;
    const failedSubjects = subjectWise.length - passedSubjects;
    const passFailData = [
        { name: "Pass", value: passedSubjects, color: "#10b981" },
        { name: "Fail", value: failedSubjects, color: "#ef4444" },
    ];

    // Logic for Badges and Insights
    const rankBadge = overall.rank === 1 ? "🥇" : overall.rank === 2 ? "🥈" : overall.rank === 3 ? "🥉" : null;
    const showNeedsImprovement = overall.percentage < 40;
    const showExcellent = overall.percentage > 80;
    const weakSubjects = subjectWise.filter((s: any) => !s.pass).map((s: any) => s.subject);

    return (
        <div className="w-full bg-slate-50 min-h-screen text-slate-800 p-4 md:p-8 space-y-8 rounded-xl shadow-inner">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-4 border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Performance Analytics</h2>
                    <p className="text-slate-500 mt-1">
                        {studentInfo.name} &bull; Class {studentInfo.class} {studentInfo.section && `(${studentInfo.section})`}
                    </p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="mt-4 md:mt-0 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-lg shadow-sm border">
                        Close Analytics
                    </button>
                )}
            </div>

            {/* Smart Insights Alert Bar */}
            {(showNeedsImprovement || showExcellent || weakSubjects.length > 0) && (
                <div className="flex flex-col gap-3">
                    {showExcellent && (
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
                            <span className="text-2xl">🔥</span>
                            <span className="font-medium">Excellent Performance! This student is performing exceptionally well.</span>
                        </div>
                    )}
                    {showNeedsImprovement && (
                        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <span className="font-medium">Needs Improvement! The overall percentage is below 40%. Consider extra attention.</span>
                        </div>
                    )}
                    {weakSubjects.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl shadow-sm flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.587 9.93c.75 1.334-.214 2.971-1.742 2.971H4.412c-1.528 0-2.492-1.637-1.742-2.971l5.587-9.93ZM11 13a1 1 0 10-2 0 1 1 0 002 0Zm-1-6a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 0010 7Z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold">Needs attention</p>
                                <p className="text-sm">
                                    Weak in {weakSubjects.join(", ")}. Focus on revision to cross passing marks.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Section 1: Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Percentage */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Percentage</p>
                    <h3 className={`text-4xl font-extrabold ${overall.percentage >= 60 ? 'text-emerald-500' : overall.percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {overall.percentage.toFixed(1)}%
                    </h3>
                </div>
                {/* Rank */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Class Rank</p>
                    <div className="flex items-center gap-2">
                        <h3 className="text-4xl font-extrabold text-blue-600">
                            {overall.rank ? `#${overall.rank}` : "N/A"}
                        </h3>
                        {rankBadge && <span className="text-3xl ml-1">{rankBadge}</span>}
                    </div>
                </div>
                {/* Total Marks */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Total Marks</p>
                    <h3 className="text-4xl font-extrabold text-slate-700">
                        {overall.totalMarks}
                    </h3>
                </div>
                {/* Pass/Fail */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Status</p>
                    <h3 className={`text-3xl font-extrabold px-6 py-1 rounded-full ${overall.passStatus === "PASS" ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {overall.passStatus}
                    </h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Section 2: Subject Performance (Takes 2 columns) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                        <div className="w-1 h-5 bg-blue-500 rounded-full mr-3"></div>
                        Subject Performance
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectWise} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="marks" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                    {subjectWise.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.pass ? '#3b82f6' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Section 5: Pass Percentage Donut */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                        <div className="w-1 h-5 bg-violet-500 rounded-full mr-3"></div>
                        Subject Pass Rate
                    </h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={passFailData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {passFailData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`${value} Subjects`, 'Count']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-slate-700">{Math.round((passedSubjects / subjectWise.length) * 100)}%</span>
                            <span className="text-xs font-semibold text-slate-400">PASSED</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 6: Attendance Analytics */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full mr-3"></div>
                        Attendance (Last 30 Days)
                    </h3>
                    <div className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full w-fit">
                        Average {attendance.averagePercentage.toFixed(1)}%
                    </div>
                </div>
                <div className="mt-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={attendance.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                            <Tooltip
                                cursor={{ stroke: "#10b981", strokeWidth: 1, fill: "rgba(16,185,129,0.08)" }}
                                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                            />
                            <Line
                                type="monotone"
                                dataKey="percentage"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ r: 3, strokeWidth: 2, fill: "#fff" }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section 3: Trend Graph */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                        <div className="w-1 h-5 bg-rose-500 rounded-full mr-3"></div>
                        Growth Trend
                    </h3>
                    <div className="h-64 w-full">
                        {trends && trends.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="examName" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="percentage"
                                        stroke="#8b5cf6"
                                        strokeWidth={4}
                                        dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 5 }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Not enough data for trend
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 4: Class Comparison */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                        <div className="w-1 h-5 bg-teal-500 rounded-full mr-3"></div>
                        Class Comparison
                    </h3>
                    <div className="flex-1 flex flex-col justify-center space-y-6">

                        {/* Student vs Avg */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-slate-700">Your Score</span>
                                <span className="text-sm font-bold text-slate-700">{overall.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3">
                                <div className={`h-3 rounded-full ${overall.percentage >= classStats.classAverage ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${overall.percentage}%` }}></div>
                            </div>
                        </div>

                        {/* Class Avg */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-semibold text-slate-500">Class Average</span>
                                <span className="text-sm font-semibold text-slate-500">{classStats.classAverage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3">
                                <div className="bg-blue-400 h-3 rounded-full" style={{ width: `${classStats.classAverage}%` }}></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="bg-slate-50 p-4 rounded-xl border">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Highest Score</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{classStats.highest.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Lowest Score</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{classStats.lowest.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
