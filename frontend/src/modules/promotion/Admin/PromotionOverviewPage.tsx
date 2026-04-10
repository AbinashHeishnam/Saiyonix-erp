import { useEffect, useMemo, useState } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import AcademicYearFilter from "../../../components/AcademicYearFilter";
import StatCard from "../../../components/StatCard";
import { useAsync } from "../../../hooks/useAsync";
import api from "../../../services/api/client";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PromotionTable from "../components/PromotionTable";

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatClassName(name?: string | null) {
  if (!name) return "—";
  if (/^\d+$/.test(name)) return `Class ${name}`;
  return name;
}

type AcademicYear = {
  id: string;
  label: string;
  isActive?: boolean;
  startDate?: string;
};

export default function PromotionOverviewPage() {
  const { data: yearData } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 50 } });
    return res.data?.data ?? res.data;
  }, []);

  const academicYears = useMemo(() => normalizeList<AcademicYear>(yearData), [yearData]);
  const defaultYear = useMemo(() => {
    const locked = academicYears
      .filter((y) => (y as any).isLocked)
      .sort((a, b) => {
        const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bd - ad;
      });
    return locked[0] ?? academicYears.find((y) => y.isActive) ?? academicYears[0];
  }, [academicYears]);

  const [academicYearId, setAcademicYearId] = useState(defaultYear?.id ?? "");

  useEffect(() => {
    if (!academicYearId && defaultYear?.id) {
      setAcademicYearId(defaultYear.id);
    }
  }, [academicYearId, defaultYear]);

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!academicYearId) return [] as any[];
    const res = await api.get("/promotion/list", { params: { academicYearId } });
    return normalizeList<any>(res.data?.data ?? res.data);
  }, [academicYearId]);

  const {
    data: criteriaData,
    loading: criteriaLoading,
    error: criteriaError,
  } = useAsync(async () => {
    if (!academicYearId) return null;
    const res = await api.get("/promotion/criteria", { params: { academicYearId } });
    return res.data?.data ?? res.data;
  }, [academicYearId]);

  const records = useMemo(() => normalizeList<any>(data), [data]);

  const summary = useMemo(() => {
    const total = records.length;
    const promoted = records.filter((r) => r.status === "PROMOTED" || r.status === "ELIGIBLE").length;
    const notPromoted = records.filter((r) => r.status === "NOT_PROMOTED" || r.status === "FAILED").length;
    const under = records.filter((r) => r.status === "UNDER_CONSIDERATION").length;
    return { total, promoted, notPromoted, under };
  }, [records]);

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Promotion Overview" subtitle="Published promotion outcomes and summary." />

      <Card title="Filters" subtitle="Select academic year to view promotion results.">
        <div className="flex flex-col gap-4">
          <AcademicYearFilter
            value={academicYearId}
            onChange={setAcademicYearId}
            syncQueryKey="academicYearId"
          />
          <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3 text-xs text-ink-500">
            Promotion records are saved against the source academic year (the year being promoted).
          </div>
          <div className="flex items-center justify-end">
            <button
              className="rounded-lg px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-ink-50"
              onClick={refresh}
            >
              Refresh
            </button>
          </div>
        </div>
      </Card>

      <Card title="Published Criteria" subtitle="Criteria used for the published promotion.">
        {criteriaLoading ? (
          <Loader label="Loading criteria..." />
        ) : criteriaError ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{criteriaError}</div>
        ) : !criteriaData ? (
          <EmptyState
            title="No criteria found"
            description="Criteria will appear once configured."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
              <p className="text-xs text-ink-500">Minimum Attendance</p>
              <p className="text-base font-semibold text-ink-800">
                {criteriaData.minAttendancePercent ?? "—"}%
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
              <p className="text-xs text-ink-500">Maximum Failed Subjects Allowed</p>
              <p className="text-base font-semibold text-ink-800">
                {criteriaData.minSubjectPassCount ?? "—"}
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Students" value={summary.total} color="ink" />
        <StatCard label="Promoted" value={summary.promoted} color="jade" />
        <StatCard label="Under Consideration" value={summary.under} color="sunrise" />
        <StatCard label="Not Promoted" value={summary.notPromoted} color="sky" />
      </div>

      <Card title="Promotion Results" subtitle="Students and their promotion outcome." noPadding>
        <div className="p-6">
          {loading ? (
            <Loader label="Loading promotion results..." />
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : records.length === 0 ? (
            <EmptyState
              title="No promotion data"
              description="Publish promotions to see results here."
            />
          ) : (
            <PromotionTable
              columns={["Student", "Class", "Section", "Status"]}
              rows={records}
              renderRow={(row) => (
                <tr key={row.id} className="rounded-2xl bg-white shadow-sm">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-ink-800">{row.student?.fullName ?? "—"}</div>
                    <div className="text-xs text-ink-400">{row.studentId ?? ""}</div>
                  </td>
                  <td className="px-3 py-3 text-ink-700">
                    {formatClassName(row.class?.className)}
                  </td>
                  <td className="px-3 py-3 text-ink-700">{row.section?.sectionName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={row.status}>{row.status ?? "—"}</StatusBadge>
                  </td>
                </tr>
              )}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
