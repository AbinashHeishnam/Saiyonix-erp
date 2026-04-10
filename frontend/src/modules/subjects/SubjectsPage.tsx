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

type Subject = { id: string; code?: string; name: string; isElective?: boolean };

const columns: Column<Subject>[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Subject" },
  {
    key: "isElective",
    label: "Type",
    render: (r) => (
      <StatusBadge variant={r.isElective ? "info" : "neutral"} dot={false}>
        {r.isElective ? "Elective" : "Core"}
      </StatusBadge>
    ),
  },
];

export default function SubjectsPage() {
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get("/subjects", { params: { page: 1, limit: 100 } });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, []);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ code: "", name: "", isElective: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", isElective: false });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Subject) => {
    setEditing(row);
    setForm({
      code: row.code ?? "",
      name: row.name ?? "",
      isElective: Boolean(row.isElective),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setFormError(null);

    if (!form.code.trim()) {
      setFormError("Subject code is required.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Subject name is required.");
      return;
    }

    const duplicateCode = items.find(
      (item) =>
        item.code?.toLowerCase() === form.code.trim().toLowerCase() &&
        item.id !== editing?.id
    );
    if (duplicateCode) {
      setFormError("Subject code already exists.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        isElective: form.isElective,
      };
      if (editing) {
        await safeApiCall(
          () => api.patch(`/subjects/${editing.id}`, payload),
          { loading: "Updating subject...", success: "Subject updated successfully" }
        );
      } else {
        await safeApiCall(
          () => api.post("/subjects", payload),
          { loading: "Creating subject...", success: "Subject created successfully" }
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

  const handleDelete = async (row: Subject) => {
    await safeApiCall(
      () => api.delete(`/subjects/${row.id}`),
      { loading: "Deleting subject...", success: "Subject deleted successfully" }
    );
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Subjects" subtitle="Subject library and management" />
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Create subjects and mark electives.</p>
        <Button onClick={openCreate}>Create Subject</Button>
      </div>

      <Card noPadding>
        <div className="p-4">
          <DataTable<Subject>
            columns={columns}
            data={items}
            loading={loading}
            error={error}
            searchable
            searchKeys={["name", "code"]}
            emptyTitle="No subjects"
            actions={(row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteSubject(row)}>
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Subject" : "Create Subject"}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Code"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isElective}
              onChange={(event) => setForm({ ...form, isElective: event.target.checked })}
            />
            Elective subject
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
        open={Boolean(deleteSubject)}
        onClose={() => setDeleteSubject(null)}
        onConfirm={() => {
          if (deleteSubject) void handleDelete(deleteSubject);
        }}
        title="Delete Subject"
        message={`Are you sure you want to delete subject "${deleteSubject?.name}"? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
}
