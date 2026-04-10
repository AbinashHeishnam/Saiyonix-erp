import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/Button";
import Input from "../../components/Input";
import StatusBadge from "../../components/StatusBadge";
import SecureImage from "../../components/SecureImage";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type Teacher = {
  id: string;
  fullName: string;
  employeeId?: string;
  designation?: string;
  phone?: string;
  email?: string;
  status?: string;
  photoUrl?: string | null;
};

function getInitials(name?: string) {
  if (!name) return "T";
  const parts = name.trim().split(" ");
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const [academicYearId, setAcademicYearId] = useState("");
  const { data, loading, error } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 100 };
    if (academicYearId) {
      // TODO: Backend should support academicYearId filtering for teacher assignments.
      params.academicYearId = academicYearId;
    }
    const res = await api.get("/teachers", { params });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [academicYearId]);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const list = (data ?? []) as Teacher[];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((t) =>
      [t.fullName, t.employeeId, t.designation, t.phone, t.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [data, query]);

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">

      {/* Directory Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Teacher Directory</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Manage staff profiles, roles, and assignments.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/admin/teachers/imports")} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Bulk Import
            </span>
          </Button>
        </div>
      </div>

      {/* Floating Filter Dock */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 rounded-2xl p-3 px-4">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Search by name, ID, phone, or email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="bg-transparent border-none shadow-none focus:ring-0 px-2 py-1.5 text-sm font-bold text-slate-700"
          />
        </div>
        <AcademicYearFilter
          value={academicYearId}
          onChange={setAcademicYearId}
          syncQueryKey="academicYearId"
        />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {items.length} {items.length === 1 ? 'Result' : 'Results'}
        </span>
      </div>

      {/* Profile Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </div>
      ) : items.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((teacher) => (
            <div
              key={teacher.id}
              className="group relative flex flex-col justify-between rounded-3xl bg-white border border-slate-100 p-6 shadow-sm transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-indigo-100"
            >
              <div className="absolute top-4 right-4">
                <StatusBadge variant={teacher.status === "ACTIVE" ? "success" : "inactive"} dot={true}>
                  {teacher.status ?? "—"}
                </StatusBadge>
              </div>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-black text-white shadow-md ring-4 ring-white overflow-hidden">
                  {teacher.photoUrl ? (
                    <SecureImage
                      fileUrl={teacher.photoUrl}
                      alt={teacher.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(teacher.fullName)
                  )}
                </div>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                  {teacher.fullName}
                </h3>
                <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-500 mt-1">
                  {teacher.designation ?? "Staff Member"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 border border-slate-100/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm text-[10px]">🆔</span>
                  <span className="text-[13px] font-bold text-slate-600">{teacher.employeeId ?? "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm text-[10px]">📞</span>
                  <span className="text-[13px] font-bold text-slate-600">{teacher.phone ?? "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm text-[10px]">✉️</span>
                  <span className="text-[13px] font-bold text-slate-600 truncate">{teacher.email ?? "N/A"}</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/admin/teacher/${teacher.id}`)}
                  className="w-full rounded-xl bg-indigo-50 py-2.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white"
                >
                  View Profile
                </button>
                <button
                  onClick={() => navigate(`/teachers/${teacher.id}/profile`)}
                  className="w-full rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Edit Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <span className="text-6xl mb-4">👥</span>
          <p className="text-lg font-bold text-slate-500">No teachers found.</p>
        </div>
      )}
    </div>
  );
}
