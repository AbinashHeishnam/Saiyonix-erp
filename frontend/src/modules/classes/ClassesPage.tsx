import { useMemo, useState } from "react";

import Button from "../../components/Button";
import DataTable, { Column } from "../../components/DataTable";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import Select from "../../components/Select";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import StatusBadge from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import ConfirmDialog from "../../components/ConfirmDialog";

type AcademicYear = { id: string; label: string; isActive?: boolean };
type ClassItem = {
  id: string;
  className: string;
  classOrder?: number;
  isHalfDay?: boolean;
  academicYearId?: string;
  academicYear?: { id?: string; label?: string };
};

const columns: Column<ClassItem>[] = [
  { key: "className", label: "Class" },
  { key: "classOrder", label: "Order" },
  {
    key: "isHalfDay",
    label: "Type",
    render: (row) => (
      <StatusBadge variant={row.isHalfDay ? "info" : "success"} dot={false}>
        {row.isHalfDay ? "Half Day" : "Full Day"}
      </StatusBadge>
    ),
  },
  {
    key: "academicYear.label",
    label: "Academic Year",
    render: (row) => row.academicYear?.label ?? "—",
  },
];

export default function ClassesPage() {
  const [filterYearId, setFilterYearId] = useState("");

  const { data, loading, error, refresh } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 100 };
    if (filterYearId) params.academicYearId = filterYearId;
    const res = await api.get("/classes", { params });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [filterYearId]);

  const { data: years } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 100 } });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, []);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const academicYears = useMemo(
    () => (Array.isArray(years) ? (years as AcademicYear[]) : []),
    [years]
  );
  const filteredItems = useMemo(() => items, [items]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({
    className: "",
    classOrder: "",
    academicYearId: "",
    isHalfDay: false,
    totalSections: "1",
    capacity: "30",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteClass, setDeleteClass] = useState<ClassItem | null>(null);

  const openCreate = () => {
    const activeYear = academicYears.find((year) => year.isActive);
    setEditing(null);
    setForm({
      className: "",
      classOrder: "",
      academicYearId: activeYear?.id ?? "",
      isHalfDay: false,
      totalSections: "1",
      capacity: "30",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: ClassItem) => {
    setEditing(row);
    setForm({
      className: row.className ?? "",
      classOrder: row.classOrder != null ? String(row.classOrder) : "",
      academicYearId: row.academicYearId ?? row.academicYear?.id ?? "",
      isHalfDay: Boolean(row.isHalfDay),
      totalSections: "1",
      capacity: "30",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);


    if (!form.className.trim()) {
      setFormError("Class name is required.");
      return;
    }
    if (!form.classOrder) {
      setFormError("Class order is required.");
      return;
    }
    if (!form.academicYearId) {
      setFormError("Academic year is required.");
      return;
    }
    if (!editing) {
      if (!form.totalSections) {
        setFormError("Total sections is required.");
        return;
      }
      if (!form.capacity) {
        setFormError("Capacity is required.");
        return;
      }
    }

    const duplicate = items.find(
      (item) =>
        item.academicYearId === form.academicYearId &&
        item.className.toLowerCase() === form.className.trim().toLowerCase() &&
        item.id !== editing?.id
    );
    if (duplicate) {
      setFormError("Class already exists for this academic year.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        className: form.className.trim(),
        classOrder: Number(form.classOrder),
        academicYearId: form.academicYearId,
        isHalfDay: form.isHalfDay,
      };
      if (editing) {
        await safeApiCall(
          () => api.patch(`/classes/${editing.id}`, payload),
          { loading: "Updating class...", success: "Class updated successfully" }
        );
      } else {
        await safeApiCall(
          () => api.post("/classes", {
            ...payload,
            totalSections: Number(form.totalSections),
            capacity: Number(form.capacity),
          }),
          { loading: "Creating class...", success: "Class created successfully" }
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

  const handleDelete = async (row: ClassItem) => {
    await safeApiCall(
      () => api.delete(`/classes/${row.id}`),
      { loading: "Deleting class...", success: "Class deleted successfully" }
    );
    refresh();
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">

      {/* Directory Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Academic Classes</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Manage class master data (Nursery to Class 12) per academic year.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Class
            </span>
          </Button>
        </div>
      </div>



      {/* Advanced DataTable Container */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <AcademicYearFilter
              value={filterYearId}
              onChange={setFilterYearId}
              syncQueryKey="academicYearId"
            />
          </div>
          <DataTable<ClassItem>
            columns={columns}
            data={filteredItems}
            loading={loading}
            error={error}
            searchable
            searchKeys={["className"]}
            emptyTitle="No academic classes found"
            emptyDescription="Get started by creating the first class for the current academic year."
            actions={(row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => openEdit(row)} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteClass(row)} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50">
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </div>

      {/* Premium Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Class Details" : "Create New Class"}>
        <div className="grid gap-4 md:grid-cols-2 pt-2">
          <Input
            label="Class Name"
            placeholder="e.g. Class 1"
            value={form.className}
            onChange={(event) => setForm({ ...form, className: event.target.value })}
          />
          <Input
            label="Class Order (Sort Priority)"
            type="number"
            min={0}
            placeholder="e.g. 1"
            value={form.classOrder}
            onChange={(event) => setForm({ ...form, classOrder: event.target.value })}
          />
          <Select
            label="Target Academic Year"
            value={form.academicYearId}
            onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}
          >
            <option value="">Select year...</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label} {year.isActive ? "(Active)" : ""}
              </option>
            ))}
          </Select>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer transition-colors hover:bg-slate-100">
              <input
                type="checkbox"
                checked={form.isHalfDay}
                onChange={(event) => setForm({ ...form, isHalfDay: event.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-700">Designate as Half-day class</span>
            </label>
          </div>

          {!editing && (
            <>
              <div className="mt-2 md:col-span-2 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Initial Setup Parameters</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Number of Sections to Auto-Create"
                    type="number"
                    min={1}
                    max={26}
                    value={form.totalSections}
                    onChange={(event) => setForm({ ...form, totalSections: event.target.value })}
                  />
                  <Input
                    label="Capacity per Section"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {formError && (
          <p className="mt-4 text-sm font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{formError}</p>
        )}

        <div className="mt-8 flex gap-3 pb-2">
          <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            {saving ? "Saving Changes..." : editing ? "Update Class" : "Create Class"}
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteClass)}
        onClose={() => setDeleteClass(null)}
        onConfirm={() => {
          if (deleteClass) void handleDelete(deleteClass);
        }}
        title="Delete Class"
        message={`Are you sure you want to delete class "${deleteClass?.className}"? This will remove its sections and cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
}
