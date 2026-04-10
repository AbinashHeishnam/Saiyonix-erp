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

type AcademicYear = {
  id: string;
  label: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  isLocked?: boolean;
};

const columns: Column<AcademicYear>[] = [
  { key: "label", label: "Year" },
  {
    key: "startDate",
    label: "Start",
    render: (r) => (r.startDate ? new Date(r.startDate).toLocaleDateString("en-IN") : "—"),
  },
  {
    key: "endDate",
    label: "End",
    render: (r) => (r.endDate ? new Date(r.endDate).toLocaleDateString("en-IN") : "—"),
  },
  {
    key: "isActive",
    label: "Status",
    render: (r) => (
      <StatusBadge variant={r.isActive ? "active" : "inactive"}>
        {r.isActive ? "Active" : "Inactive"}
      </StatusBadge>
    ),
  },
  {
    key: "isLocked",
    label: "Locked",
    render: (r) => (
      <StatusBadge variant={r.isLocked ? "warning" : "neutral"} dot={false}>
        {r.isLocked ? "Locked" : "Open"}
      </StatusBadge>
    ),
  },
];

function toInputDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function AcademicYearsPage() {
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 50 } });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, []);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState({
    label: "",
    startDate: "",
    endDate: "",
    isActive: false,
    isLocked: false,
    cloneFromPrevious: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteYear, setDeleteYear] = useState<AcademicYear | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({
      label: "",
      startDate: "",
      endDate: "",
      isActive: false,
      isLocked: false,
      cloneFromPrevious: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: AcademicYear) => {
    setEditing(row);
    setForm({
      label: row.label ?? "",
      startDate: toInputDate(row.startDate),
      endDate: toInputDate(row.endDate),
      isActive: Boolean(row.isActive),
      isLocked: Boolean(row.isLocked),
      cloneFromPrevious: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setFormError(null);

    if (!form.label.trim()) {
      setFormError("Label is required.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setFormError("Start date and end date are required.");
      return;
    }
    if (form.startDate > form.endDate) {
      setFormError("Start date must be before end date.");
      return;
    }

    const duplicate = items.find(
      (item) => item.label.toLowerCase() === form.label.trim().toLowerCase() && item.id !== editing?.id
    );
    if (duplicate) {
      setFormError("Academic year label already exists.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
        isLocked: form.isLocked,
        ...(form.cloneFromPrevious ? { cloneFromPrevious: true } : {}),
      };
      if (editing) {
        await safeApiCall(
          () => api.patch(`/academic-years/${editing.id}`, payload),
          { loading: "Updating academic year...", success: "Academic year updated successfully" }
        );
      } else {
        await safeApiCall(
          () => api.post("/academic-years", payload),
          { loading: "Creating academic year...", success: "Academic year created successfully" }
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

  const handleDelete = async (row: AcademicYear) => {
    await safeApiCall(
      () => api.delete(`/academic-years/${row.id}`),
      { loading: "Deleting academic year...", success: "Academic year deleted successfully" }
    );
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Academic Years" subtitle="Manage academic year cycles and rollovers" />
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Create and manage academic sessions.</p>
        <Button onClick={openCreate}>Create Academic Year</Button>
      </div>

      <Card noPadding>
        <div className="p-4">
          <DataTable<AcademicYear>
            columns={columns}
            data={items}
            loading={loading}
            error={error}
            emptyTitle="No academic years"
            actions={(row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteYear(row)}>
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Academic Year" : "Create Academic Year"}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Label"
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Active academic year
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isLocked}
              onChange={(event) => setForm({ ...form, isLocked: event.target.checked })}
            />
            Locked
          </label>
          {!editing && (
            <label className="flex items-start gap-2 text-sm text-ink-700 md:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.cloneFromPrevious}
                onChange={(event) => setForm({ ...form, cloneFromPrevious: event.target.checked })}
              />
              <span>
                Clone From Previous Year
                <span className="block text-xs text-ink-500">
                  Copies classes, sections, periods, subjects, and class-subject mappings.
                </span>
              </span>
            </label>
          )}
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
        open={Boolean(deleteYear)}
        onClose={() => setDeleteYear(null)}
        onConfirm={() => {
          if (deleteYear) void handleDelete(deleteYear);
        }}
        title="Delete Academic Year"
        message={`Are you sure you want to delete academic year "${deleteYear?.label}"? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
}
