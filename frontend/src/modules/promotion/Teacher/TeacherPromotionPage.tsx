import { useEffect, useMemo, useState } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/Button";
import Select from "../../../components/Select";
import { useAsync } from "../../../hooks/useAsync";
import api, { safeApiCall } from "../../../services/api/client";
import { updateManualPromotions, type PromotionPreviewRecord } from "../../../services/api/promotion";
import PromotionTable from "../components/PromotionTable";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";
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
  isLocked?: boolean;
  startDate?: string;
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

export default function TeacherPromotionPage() {
  const { data: yearData, loading: yearLoading } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 50 } });
    return res.data?.data ?? res.data;
  }, []);

  const academicYears = useMemo(() => normalizeList<AcademicYear>(yearData), [yearData]);
  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0],
    [academicYears]
  );

  const [fromAcademicYearId, setFromAcademicYearId] = useState("");
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [promoteBy, setPromoteBy] = useState<"RANK" | "PERCENTAGE">("PERCENTAGE");

  useEffect(() => {
    if (!fromAcademicYearId && activeYear?.id) {
      setFromAcademicYearId(activeYear.id);
    }
  }, [fromAcademicYearId, activeYear]);

  useEffect(() => {
    setOverrides({});
  }, [fromAcademicYearId, toAcademicYearId, promoteBy]);

  useEffect(() => {
    if (!academicYears.length) return;
    if (!fromAcademicYearId) return;
    if (!toAcademicYearId || toAcademicYearId === fromAcademicYearId) {
      const fromYear = academicYears.find((y) => y.id === fromAcademicYearId);
      const fromDate = fromYear?.startDate ? new Date(fromYear.startDate).getTime() : null;
      const candidates = academicYears
        .filter((y) => y.id !== fromAcademicYearId)
        .sort((a, b) => {
          const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
          return ad - bd;
        });
      const nextYear = fromDate
        ? candidates.find((y) => (y.startDate ? new Date(y.startDate).getTime() : 0) > fromDate)
        : candidates[0];
      setToAcademicYearId(nextYear?.id ?? "");
    }
  }, [academicYears, fromAcademicYearId, toAcademicYearId]);

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!fromAcademicYearId) return [] as PromotionPreviewRecord[];
    const res = await api.get("/promotion/list", { params: { academicYearId: fromAcademicYearId } });
    const payload = res.data?.data ?? res.data;
    return normalizeList<PromotionPreviewRecord>(payload);
  }, [fromAcademicYearId]);

  const records = useMemo(() => normalizeList<PromotionPreviewRecord>(data), [data]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const selectedFrom = academicYears.find((y) => y.id === fromAcademicYearId);
  const fromLocked = Boolean(selectedFrom?.isLocked);
  const sameYearSelected =
    !!fromAcademicYearId && !!toAcademicYearId && fromAcademicYearId === toAcademicYearId;

  useEffect(() => {
    const next: Record<string, boolean> = {};
    records.forEach((row) => {
      if (row.id) {
        next[row.id] = Boolean(row.isManuallyPromoted);
      }
    });
    setOverrides(next);
  }, [records]);

  const hasChanges = useMemo(() => {
    return records.some(
      (row) => row.id && overrides[row.id] !== Boolean(row.isManuallyPromoted)
    );
  }, [records, overrides]);

  const handleToggle = (record: PromotionPreviewRecord) => {
    if (!record.id) return;
    const canOverride = record.status === "FAILED";
    if (!canOverride) return;
    setOverrides((prev) => ({ ...prev, [record.id as string]: !prev[record.id as string] }));
  };

  const handleSave = async () => {
    if (!fromAcademicYearId || !toAcademicYearId || fromLocked || records.length === 0) return;
    const updates = records
      .filter((row) => row.id)
      .filter((row) => overrides[row.id as string] !== Boolean(row.isManuallyPromoted))
      .map((row) => ({
        promotionRecordId: row.id as string,
        studentId: row.studentId,
        isManuallyPromoted: Boolean(overrides[row.id as string]),
      }));
    if (updates.length === 0) return;

    setSaving(true);
    try {
      await safeApiCall(
        () => updateManualPromotions(updates),
        { loading: "Saving overrides...", success: "Overrides saved" }
      );
      refresh();
    } catch {
      // handled by toast
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Promotion Management"
        subtitle="Review student eligibility and handle under-consideration promotions."
      />

      <Card title="Promotion Filters" subtitle="Select academic years and promotion type.">
        {yearLoading ? (
          <Loader label="Loading academic years..." />
        ) : academicYears.length === 0 ? (
          <EmptyState
            title="No academic years"
            description="Create academic years to start promotions."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                label="From Academic Year"
                value={fromAcademicYearId}
                onChange={(e) => setFromAcademicYearId(e.target.value)}
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
                onChange={(e) => setToAcademicYearId(e.target.value)}
              >
                <option value="">Select year</option>
                {academicYears
                  .filter((year) => year.id !== fromAcademicYearId)
                  .map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label}
                    </option>
                  ))}
              </Select>
              <Select
                label="Promotion Type"
                value={promoteBy}
                onChange={(e) => setPromoteBy(e.target.value as "RANK" | "PERCENTAGE")}
              >
                {PROMOTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            {sameYearSelected && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700">
                Source and target academic year cannot be the same.
              </div>
            )}
            {fromLocked && (
              <div className="rounded-2xl border border-sunrise-200 bg-sunrise-50/60 p-4 text-sm text-sunrise-700">
                Promotions already published for this academic year.
              </div>
            )}
            <div className="flex items-center justify-end">
              <Button
                variant="secondary"
                onClick={refresh}
                disabled={
                  loading ||
                  !fromAcademicYearId ||
                  !toAcademicYearId ||
                  sameYearSelected ||
                  fromLocked
                }
              >
                Refresh Preview
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Promotion List"
        subtitle="Only failed students can be marked under consideration."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                loading ||
                records.length === 0 ||
                !fromAcademicYearId ||
                !toAcademicYearId ||
                sameYearSelected ||
                fromLocked ||
                !hasChanges
              }
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        }
        noPadding
      >
        <div className="p-6">
          {loading ? (
            <Loader label="Loading promotion list..." />
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : records.length === 0 ? (
            <EmptyState
              title="No students match promotion criteria"
              description="Adjust criteria or academic years to see eligible students."
            />
          ) : (
            <PromotionTable
              columns={[
                "Student Name",
                "Attendance %",
                "Failed Subjects",
                "Percentage",
                "Rank",
                "Status",
                "Promote Under Consideration",
              ]}
              rows={records}
              renderRow={(row) => {
                const isOverridden = Boolean(overrides[row.id as string]);
                const status = isOverridden ? "UNDER_CONSIDERATION" : row.status;
                const failedSubjects =
                  row.failedSubjects ??
                  (row.totalSubjects != null && row.passedSubjects != null
                    ? Math.max(0, row.totalSubjects - row.passedSubjects)
                    : null);
                return (
                  <tr
                    key={row.id}
                    className={`rounded-2xl bg-white shadow-sm transition ${
                      isOverridden ? "bg-sunrise-50/60" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="font-semibold text-ink-800">{getStudentName(row)}</div>
                      <div className="text-xs text-ink-400">{row.studentId ?? ""}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{row.attendancePercent ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{failedSubjects ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{row.percentage ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{row.rank ?? "—"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={status}>{status ?? "—"}</StatusBadge>
                    </td>
                    <td className="px-3 py-3">
                      <ToggleSwitch
                        checked={isOverridden}
                        onChange={() => handleToggle(row)}
                        disabled={
                          row.status !== "FAILED" ||
                          saving ||
                          loading ||
                          fromLocked
                        }
                        label="Promote Under Consideration"
                      />
                    </td>
                  </tr>
                );
              }}
            />
          )}
        </div>
      </Card>

    </div>
  );
}
