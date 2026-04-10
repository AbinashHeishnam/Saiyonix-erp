import { useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import DataTable, { Column } from "../../components/DataTable";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import ConfirmDialog from "../../components/ConfirmDialog";
import { formatTime } from "../../utils/time";

type Period = {
  id: string;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  isLunch?: boolean;
  isFirstPeriod?: boolean;
};

const columns: Column<Period>[] = [
  { key: "periodNumber", label: "Period" },
  { key: "startTime", label: "Start", render: (row) => formatTime(row.startTime) },
  { key: "endTime", label: "End", render: (row) => formatTime(row.endTime) },
  {
    key: "isLunch",
    label: "Type",
    render: (r) => (
      <StatusBadge variant={r.isLunch ? "warning" : "neutral"} dot={false}>
        {r.isLunch ? "Lunch Break" : "Period"}
      </StatusBadge>
    ),
  },
];

function toTimeValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
}

export default function PeriodsPage() {
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get("/periods", { params: { page: 1, limit: 50 } });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, []);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [form, setForm] = useState({
    periodNumber: "",
    startTime: "",
    endTime: "",
    isLunch: false,
    isFirstPeriod: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletePeriod, setDeletePeriod] = useState<Period | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({
      periodNumber: "",
      startTime: "",
      endTime: "",
      isLunch: false,
      isFirstPeriod: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Period) => {
    setEditing(row);
    setForm({
      periodNumber: String(row.periodNumber ?? ""),
      startTime: toTimeValue(row.startTime),
      endTime: toTimeValue(row.endTime),
      isLunch: Boolean(row.isLunch),
      isFirstPeriod: Boolean(row.isFirstPeriod),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setFormError(null);

    if (!form.periodNumber) {
      setFormError("Period number is required.");
      return;
    }
    if (!form.startTime || !form.endTime) {
      setFormError("Start and end time are required.");
      return;
    }
    if (form.startTime >= form.endTime) {
      setFormError("Start time must be before end time.");
      return;
    }

    const duplicate = items.find(
      (item) =>
        item.periodNumber === Number(form.periodNumber) && item.id !== editing?.id
    );
    if (duplicate) {
      setFormError("Period number already exists.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        periodNumber: Number(form.periodNumber),
        startTime: form.startTime,
        endTime: form.endTime,
        isLunch: form.isLunch,
        isFirstPeriod: form.isFirstPeriod,
      };
      if (editing) {
        await safeApiCall(
          () => api.patch(`/periods/${editing.id}`, payload),
          { loading: "Updating period...", success: "Period updated successfully" }
        );
      } else {
        await safeApiCall(
          () => api.post("/periods", payload),
          { loading: "Creating period...", success: "Period created successfully" }
        );
      }
      setModalOpen(false);
      refresh();
    } catch {
      // Handled by toast
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Period) => {
    await safeApiCall(
      () => api.delete(`/periods/${row.id}`),
      { loading: "Deleting period...", success: "Period deleted successfully" }
    );
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Periods" subtitle="Period configuration, durations, and lunch breaks" />
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Configure periods and lunch breaks.</p>
        <Button onClick={openCreate}>Create Period</Button>
      </div>

      <Card noPadding>
        <div className="p-4">
          <DataTable<Period>
            columns={columns}
            data={items}
            loading={loading}
            error={error}
            emptyTitle="No periods configured"
            actions={(row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeletePeriod(row)}>
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Period" : "Create Period"}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Period Number"
            type="number"
            min={1}
            value={form.periodNumber}
            onChange={(event) => setForm({ ...form, periodNumber: event.target.value })}
          />
          <Input
            label="Start Time"
            type="time"
            value={form.startTime}
            onChange={(event) => setForm({ ...form, startTime: event.target.value })}
          />
          <Input
            label="End Time"
            type="time"
            value={form.endTime}
            onChange={(event) => setForm({ ...form, endTime: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isLunch}
              onChange={(event) => setForm({ ...form, isLunch: event.target.checked })}
            />
            Lunch break
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isFirstPeriod}
              onChange={(event) => setForm({ ...form, isFirstPeriod: event.target.checked })}
            />
            First period
          </label>
        </div>
        {formError && <p className="mt-3 text-sm text-sunrise-600">{formError}</p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : editing ? "Update" : "Create"}
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletePeriod)}
        onClose={() => setDeletePeriod(null)}
        onConfirm={() => {
          if (deletePeriod) void handleDelete(deletePeriod);
        }}
        title="Delete Period"
        message={`Are you sure you want to delete period ${deletePeriod?.periodNumber}? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
}
