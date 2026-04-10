import { useMemo, useState } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Select from "../../../components/Select";
import Button from "../../../components/Button";
import StatCard from "../../../components/StatCard";
import { useAsync } from "../../../hooks/useAsync";
import api, { safeApiCall } from "../../../services/api/client";
import {
  getPromotionPreview,
  publishPromotion,
  updateManualPromotion,
  type PromotionPreviewRecord,
} from "../../../services/api/promotion";
import Badge from "../components/Badge";
import Table from "../components/Table";
import ToggleSwitch from "../components/ToggleSwitch";
import ConfirmationModal from "../components/ConfirmationModal";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

const PROMOTE_OPTIONS = [
  { value: "RANK", label: "Rank" },
  { value: "PERCENTAGE", label: "Percentage" },
] as const;

type AcademicYear = {
  id: string;
  label: string;
  isActive?: boolean;
};

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getStudentName(row: PromotionPreviewRecord) {
  return row.student?.fullName ?? row.studentName ?? "—";
}

function getClassName(row: PromotionPreviewRecord) {
  return row.class?.className ?? row.className ?? "—";
}

function getSectionName(row: PromotionPreviewRecord) {
  return row.section?.sectionName ?? row.sectionName ?? "—";
}

export default function PromotionDashboard() {
  const { data: academicYearData } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 50 } });
    return res.data?.data ?? res.data;
  }, []);

  const academicYears = useMemo(
    () => normalizeList<AcademicYear>(academicYearData),
    [academicYearData]
  );

  const [fromAcademicYearId, setFromAcademicYearId] = useState("");
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [promoteBy, setPromoteBy] = useState<"RANK" | "PERCENTAGE" | "">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const ready = Boolean(fromAcademicYearId && toAcademicYearId && promoteBy);

  const { data, loading, error, refresh, setData } = useAsync(async () => {
    if (!ready) return [] as PromotionPreviewRecord[];
    const res = await getPromotionPreview({
      fromAcademicYearId,
      toAcademicYearId,
      promoteBy: promoteBy as "RANK" | "PERCENTAGE",
    });
    return normalizeList<PromotionPreviewRecord>(res);
  }, [fromAcademicYearId, toAcademicYearId, promoteBy]);

  const records = useMemo(() => normalizeList<PromotionPreviewRecord>(data), [data]);

  const summary = useMemo(() => {
    const total = records.length;
    const eligible = records.filter((r) => r.status === "ELIGIBLE").length;
    const failed = records.filter((r) => r.status === "FAILED").length;
    const overridden = records.filter((r) => r.isManuallyPromoted).length;
    return { total, eligible, failed, overridden };
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const paged = records.slice((page - 1) * pageSize, page * pageSize);

  const handleToggleOverride = async (record: PromotionPreviewRecord) => {
    if (!record.id) return;
    const nextValue = !record.isManuallyPromoted;
    setUpdatingId(record.id);
    setData((prev) => {
      const list = normalizeList<PromotionPreviewRecord>(prev);
      return list.map((item) =>
        item.id === record.id ? { ...item, isManuallyPromoted: nextValue } : item
      );
    });
    try {
      await safeApiCall(
        () => updateManualPromotion({ promotionRecordId: record.id, isManuallyPromoted: nextValue }),
        { loading: "Updating override...", success: "Override updated" }
      );
    } catch {
      setData((prev) => {
        const list = normalizeList<PromotionPreviewRecord>(prev);
        return list.map((item) =>
          item.id === record.id ? { ...item, isManuallyPromoted: !nextValue } : item
        );
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePublish = async () => {
    if (!ready) return;
    setPublishing(true);
    try {
      await safeApiCall(
        () =>
          publishPromotion({
            fromAcademicYearId,
            toAcademicYearId,
            promoteBy: promoteBy as "RANK" | "PERCENTAGE",
          }),
        { loading: "Publishing promotions...", success: "Promotion published successfully" }
      );
      setConfirmOpen(false);
      refresh();
    } catch {
      // handled by toast
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Promotion Management"
        subtitle="Preview, verify, and publish promotions for the next academic year."
      />

      <Card title="Promotion Filters" subtitle="Select academic years and promotion strategy.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="From Academic Year"
            value={fromAcademicYearId}
            onChange={(e) => {
              setFromAcademicYearId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Select year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </Select>
          <Select
            label="To Academic Year"
            value={toAcademicYearId}
            onChange={(e) => {
              setToAcademicYearId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Select year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </Select>
          <Select
            label="Promotion Type"
            value={promoteBy}
            onChange={(e) => {
              setPromoteBy(e.target.value as "RANK" | "PERCENTAGE" | "");
              setPage(1);
            }}
          >
            <option value="">Select type</option>
            {PROMOTE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-ink-500">
            Configure and preview promotions before publishing.
          </p>
          <Button variant="secondary" onClick={refresh} disabled={!ready || loading}>
            Refresh Preview
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Students" value={summary.total} color="ink" />
        <StatCard label="Eligible" value={summary.eligible} color="jade" />
        <StatCard label="Failed" value={summary.failed} color="sunrise" />
        <StatCard label="Overridden" value={summary.overridden} color="sky" />
      </div>

      <Card
        title="Promotion Preview"
        subtitle="Review eligibility and overrides before publishing."
        actions={
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!ready || records.length === 0 || loading}
          >
            Publish Promotion
          </Button>
        }
        noPadding
      >
        <div className="p-6">
          {loading ? (
            <Loader label="Loading promotion preview..." />
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : records.length === 0 ? (
            <EmptyState
              title={ready ? "No promotion data" : "Select filters to preview"}
              description={
                ready
                  ? "No students available for promotion preview."
                  : "Choose academic years and promotion type to view the list."
              }
            />
          ) : (
            <>
              <Table
                columns={[
                  "Student Name",
                  "Class",
                  "Section",
                  "Percentage",
                  "Rank",
                  "Attendance %",
                  "Status",
                  "Override",
                ]}
              >
                {paged.map((row) => (
                  <tr
                    key={row.id}
                    className={`rounded-2xl bg-white shadow-sm transition ${
                      row.isManuallyPromoted ? "bg-sunrise-50/60" : "" 
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="font-semibold text-ink-800">{getStudentName(row)}</div>
                      <div className="text-xs text-ink-400">{row.studentId ?? ""}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{getClassName(row)}</td>
                    <td className="px-3 py-3 text-ink-700">{getSectionName(row)}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {row.percentage ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{row.rank ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {row.attendancePercent ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge status={row.status}>{row.status ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <ToggleSwitch
                        checked={Boolean(row.isManuallyPromoted)}
                        onChange={() => handleToggleOverride(row)}
                        disabled={updatingId === row.id}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
                  <span>
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, records.length)} of {records.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-ink-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p =
                        totalPages <= 5
                          ? i + 1
                          : page <= 3
                          ? i + 1
                          : page >= totalPages - 2
                          ? totalPages - 4 + i
                          : page - 2 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            page === p ? "bg-ink-900 text-white" : "hover:bg-ink-50"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-ink-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmationModal
        open={confirmOpen}
        title="Confirm Promotion"
        message="This action will finalize promotions and cannot be undone. Do you want to proceed?"
        confirmText="Publish Promotion"
        cancelText="Cancel"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handlePublish}
        loading={publishing}
      />
    </div>
  );
}
