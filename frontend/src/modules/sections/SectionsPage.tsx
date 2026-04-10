import { useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import DataTable, { Column } from "../../components/DataTable";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import ConfirmDialog from "../../components/ConfirmDialog";

type ClassItem = { id: string; className: string; classOrder?: number };
type TeacherItem = { id: string; fullName?: string };
type SectionItem = {
  id: string;
  sectionName: string;
  capacity?: number;
  classId?: string;
  classTeacherId?: string | null;
  class?: { id?: string; className?: string };
};

export default function SectionsPage() {
  const [academicYearId, setAcademicYearId] = useState("");

  const { data, loading, error, refresh } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/sections", { params });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, [academicYearId]);

  const { data: classes } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, [academicYearId]);

  const { data: teachers } = useAsync(async () => {
    const res = await api.get("/teachers", { params: { page: 1, limit: 200 } });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, []);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const classItems = useMemo(() => (Array.isArray(classes) ? classes : []), [classes]);
  const teacherItems = useMemo(
    () => (Array.isArray(teachers) ? (teachers as TeacherItem[]) : []),
    [teachers]
  );
  const teacherById = useMemo(() => {
    const map = new Map<string, string>();
    teacherItems.forEach((teacher) => {
      if (teacher.id) map.set(teacher.id, teacher.fullName ?? "Teacher");
    });
    return map;
  }, [teacherItems]);

  const columns: Column<SectionItem>[] = [
    { key: "sectionName", label: "Section" },
    {
      key: "class.className",
      label: "Class",
      render: (row) => row.class?.className ?? "—",
    },
    { key: "capacity", label: "Capacity" },
    {
      key: "classTeacherId",
      label: "Class Teacher",
      render: (row) => (row.classTeacherId ? teacherById.get(row.classTeacherId) ?? "—" : "—"),
    },
  ];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SectionItem | null>(null);
  const [form, setForm] = useState({
    classId: "",
    sectionName: "",
    capacity: "",
    classTeacherId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteSection, setDeleteSection] = useState<SectionItem | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ classId: "", sectionName: "", capacity: "", classTeacherId: "" });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: SectionItem) => {
    setEditing(row);
    setForm({
      classId: row.classId ?? row.class?.id ?? "",
      sectionName: row.sectionName ?? "",
      capacity: row.capacity != null ? String(row.capacity) : "",
      classTeacherId: row.classTeacherId ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setFormError(null);

    if (!form.classId) {
      setFormError("Class is required.");
      return;
    }
    if (!form.sectionName.trim()) {
      setFormError("Section name is required.");
      return;
    }
    if (!form.classTeacherId) {
      setFormError("Class teacher is required.");
      return;
    }

    const duplicate = items.find(
      (item) =>
        (item.classId ?? item.class?.id) === form.classId &&
        item.sectionName.toLowerCase() === form.sectionName.trim().toLowerCase() &&
        item.id !== editing?.id
    );
    if (duplicate) {
      setFormError("Section already exists for this class.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        classId: form.classId,
        sectionName: form.sectionName.trim(),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        classTeacherId: form.classTeacherId,
      };
      if (editing) {
        await safeApiCall(
          () => api.patch(`/sections/${editing.id}`, payload),
          { loading: "Updating section...", success: "Section updated successfully" }
        );
      } else {
        await safeApiCall(
          () => api.post("/sections", payload),
          { loading: "Creating section...", success: "Section created successfully" }
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

  const handleDelete = async (row: SectionItem) => {
    await safeApiCall(
      () => api.delete(`/sections/${row.id}`),
      { loading: "Deleting section...", success: "Section deleted successfully" }
    );
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Sections" subtitle="Section setup and class teacher mapping" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">Assign class teachers and section capacity.</p>
        <AcademicYearFilter
          value={academicYearId}
          onChange={setAcademicYearId}
          syncQueryKey="academicYearId"
        />
        <Button onClick={openCreate}>Create Section</Button>
      </div>

      <Card noPadding>
        <div className="p-4">
          <DataTable<SectionItem>
            columns={columns}
            data={items}
            loading={loading}
            error={error}
            searchable
            searchKeys={["sectionName", "class.className"]}
            emptyTitle="No sections"
            actions={(row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteSection(row)}>
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Section" : "Create Section"}>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Class"
            value={form.classId}
            onChange={(event) => setForm({ ...form, classId: event.target.value })}
          >
            <option value="">Select class</option>
            {classItems.map((cls: ClassItem) => (
              <option key={cls.id} value={cls.id}>
                {cls.className}
              </option>
            ))}
          </Select>
          <Input
            label="Section Name"
            value={form.sectionName}
            onChange={(event) => setForm({ ...form, sectionName: event.target.value })}
          />
          <Input
            label="Capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(event) => setForm({ ...form, capacity: event.target.value })}
          />
          <Select
            label="Class Teacher"
            value={form.classTeacherId}
            onChange={(event) => setForm({ ...form, classTeacherId: event.target.value })}
          >
            <option value="">Select teacher</option>
            {teacherItems.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName ?? "Teacher"}
              </option>
            ))}
          </Select>
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
        open={Boolean(deleteSection)}
        onClose={() => setDeleteSection(null)}
        onConfirm={() => {
          if (deleteSection) void handleDelete(deleteSection);
        }}
        title="Delete Section"
        message={`Are you sure you want to delete section "${deleteSection?.sectionName}"? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
}
