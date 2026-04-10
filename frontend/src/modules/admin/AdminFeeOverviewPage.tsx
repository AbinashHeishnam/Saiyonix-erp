import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { getAdminFeeOverview } from "../../services/api/adminFees";
import { useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

function formatCurrencyValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return formatCurrency(0);
  return formatCurrency(numeric);
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card animate-pulse">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-9 w-9 rounded-xl bg-slate-200" />
    </div>
  );
}

export default function AdminFeeOverviewPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-fee-overview", academicYearId],
    queryFn: () => getAdminFeeOverview(academicYearId ? { academicYearId } : undefined),
    refetchInterval: 45000,
    refetchOnWindowFocus: true,
    enabled: Boolean(academicYearId),
  });

  const header = (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <PageHeader title="Fee Overview" subtitle="Real-time finance insights and collection performance" />
      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
      />
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm">
        Auto-refresh every 45s
      </div>
    </div>
  );

  if (!academicYearId) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <p className="text-sm text-slate-500">Select an academic year to view fee analytics.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={`kpi-skeleton-${idx}`} />
          ))}
        </div>
        <LoadingState label="Loading fee analytics" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card>
          <div className="flex items-center gap-3">
            <p className="text-sm text-rose-600">Unable to load fee analytics.</p>
            <button
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data.hasSetup) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card>
          <EmptyState
            title="No fee setup found"
            description="No fee setup found for the selected academic year."
          />
        </Card>
      </div>
    );
  }

  const methodColors: Record<string, string> = {
    ONLINE: "#2563eb",
    CASH: "#10b981",
    CARD: "#f59e0b",
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Fees"
          value={formatCurrency(data.totalFees)}
          color="sky"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4m8 0a4 4 0 01-8 0m8 0a4 4 0 10-8 0m8 0V6m-8 6v6" /></svg>}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(data.totalCollected)}
          color="jade"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Pending"
          value={formatCurrency(data.totalPending)}
          color="sunrise"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Collection Rate"
          value={`${data.collectionRate}%`}
          color="ink"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Student Coverage" subtitle="Paid vs unpaid enrollments">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Paid Students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.paidStudents}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">Unpaid Students</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{data.unpaidStudents}</p>
            </div>
          </div>
        </Card>

        <Card title="Total Enrollments" subtitle="All active students">
          <div className="flex h-full items-center justify-center">
            <p className="text-4xl font-extrabold text-slate-900">{data.totalStudents}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Monthly Collection Trend" subtitle="Payments received per month">
          <div className="h-72 min-h-[18rem] min-w-0">
            {data.monthlyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    formatter={(value) => [formatCurrencyValue(value), "Collected"]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}
                  />
                  <Line type="monotone" dataKey="collected" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No monthly data yet" description="Payments will appear once collections begin." />
            )}
          </div>
        </Card>

        <Card title="Payment Methods" subtitle="Share of collections">
          <div className="h-72 min-h-[18rem] min-w-0">
            {data.paymentMethodSplit.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentMethodSplit}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {data.paymentMethodSplit.map((entry, index) => (
                      <Cell key={`cell-${entry.method}-${index}`} fill={methodColors[entry.method] ?? "#6366f1"} />
                    ))}
                  </Pie>
                  <Legend />
                  <RechartsTooltip formatter={(value) => [formatCurrencyValue(value), "Amount"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No payments yet" description="Payment method distribution will appear here." />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Term Comparison" subtitle="Collections per term">
          <div className="h-72">
            {data.termComparison.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.termComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="term" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip formatter={(value) => [formatCurrencyValue(value), "Collected"]} />
                  <Bar dataKey="collected" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No term data" description="Term-wise collections will show here." />
            )}
          </div>
        </Card>

        <Card title="Class-wise Collections" subtitle="Collected vs pending by class">
          <div className="h-72">
            {data.classWise.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.classWise} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="className" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    formatter={(value, name) => [
                      formatCurrencyValue(value),
                      name === "collected" ? "Collected" : "Pending",
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="collected" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" fill="#f97316" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No class data" description="Class-wise performance will show here." />
            )}
          </div>
        </Card>
      </div>

      <Card title="Top Defaulters" subtitle="Highest pending balances">
        {data.topDefaulters?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Pending Amount</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {data.topDefaulters.map((row, index) => (
                  <tr key={`${row.studentName}-${index}`} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{row.studentName}</td>
                    <td className="py-3 pr-4">{row.className ?? "—"}</td>
                    <td className="py-3 pr-4 text-rose-600 font-semibold">{formatCurrency(row.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No defaulters found" description="All dues are currently settled." />
        )}
      </Card>
    </div>
  );
}
