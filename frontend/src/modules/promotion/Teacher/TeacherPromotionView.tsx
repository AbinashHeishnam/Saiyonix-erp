import { useEffect, useMemo, useState } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/Button";
import { useAsync } from "../../../hooks/useAsync";
import { safeApiCall } from "../../../services/api/client";
import {
  getTeacherPromotionList,
  updateManualPromotions,
  type PromotionPreviewRecord,
} from "../../../services/api/promotion";
import Badge from "../components/Badge";
import Table from "../components/Table";
import ToggleSwitch from "../components/ToggleSwitch";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

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

export default function TeacherPromotionView() {
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await getTeacherPromotionList();
    return normalizeList<PromotionPreviewRecord>(res);
  }, []);

  const records = useMemo(() => normalizeList<PromotionPreviewRecord>(data), [data]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

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
    const canOverride = record.status === "UNDER_CONSIDERATION" && !record.isManuallyPromoted;
    if (!canOverride) return;
    setOverrides((prev) => ({ ...prev, [record.id as string]: !prev[record.id as string] }));
  };

  const handleSave = async () => {
    const updates = records
      .filter((row) => row.id)
      .filter((row) => overrides[row.id as string] !== Boolean(row.isManuallyPromoted))
      .map((row) => ({
        promotionRecordId: row.id as string,
        isManuallyPromoted: Boolean(overrides[row.id as string]),
      }))
      .filter((row) => row.isManuallyPromoted);

    if (updates.length === 0) return;

    setSaving(true);
    try {
      await safeApiCall(
        () => updateManualPromotions({ updates }),
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
        title="Promotion Review"
        subtitle="Review eligible and under-consideration students before final promotion."
      />

      <Card
        title="Student Promotion List"
        subtitle="You can only promote students under consideration."
        actions={
          <Button onClick={handleSave} disabled={!hasChanges || saving} loading={saving}>
            Save Changes
          </Button>
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
              title="No promotion records"
              description="Promotion data will appear here once available."
            />
          ) : (
            <Table columns={["Student", "Class", "Percentage", "Rank", "Status", "Override"]}>
              {records.map((row) => {
                const canOverride = row.status === "UNDER_CONSIDERATION" && !row.isManuallyPromoted;
                return (
                  <tr key={row.id} className="rounded-2xl bg-white shadow-sm">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-ink-800">{getStudentName(row)}</div>
                      <div className="text-xs text-ink-400">{row.studentId ?? ""}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{getClassName(row)}</td>
                    <td className="px-3 py-3 text-ink-700">{row.percentage ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{row.rank ?? "—"}</td>
                    <td className="px-3 py-3">
                      <Badge status={row.status}>{row.status ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <ToggleSwitch
                        checked={Boolean(overrides[row.id as string])}
                        onChange={() => handleToggle(row)}
                        disabled={!canOverride || saving}
                      />
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
