import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Input from "../../components/Input";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type ParentRow = {
  id: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  relationToStudent?: string | null;
  studentCount?: number;
};

function getInitials(name?: string) {
  if (!name) return "P";
  const parts = name.trim().split(" ");
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function ParentsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(async () => {
    const res = await api.get("/parents", { params: { page: 1, limit: 100 } });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, []);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const list = (data ?? []) as ParentRow[];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((p) =>
      [p.fullName, p.mobile, p.email, p.relationToStudent]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [data, query]);

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">

      {/* Directory Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Parent Profiles</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Guardian directory, communication, and linked students.</p>
        </div>
      </div>

      {/* Floating Filter Dock */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 rounded-2xl p-3 px-4">
        <div className="w-full sm:w-[400px]">
          <Input
            placeholder="Search by name, phone, email, or relation..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="bg-transparent border-none shadow-none focus:ring-0 px-2 py-1.5 text-sm font-bold text-slate-700"
          />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {items.length} {items.length === 1 ? 'Record' : 'Records'}
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
          {items.map((parent) => (
            <div
              key={parent.id}
              className="group relative flex flex-col justify-between rounded-3xl bg-white border border-slate-100 p-6 shadow-sm transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-amber-100"
            >
              <div className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100 font-black text-amber-500 text-xs">
                {parent.studentCount ?? 0}
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] text-white">s</span>
              </div>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-100 to-rose-50 opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-2xl font-black text-white shadow-md ring-4 ring-white">
                    {getInitials(parent.fullName)}
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 tracking-tight group-hover:text-amber-600 transition-colors">
                  {parent.fullName}
                </h3>
                <p className="text-[12px] font-bold uppercase tracking-wider text-amber-500 mt-1">
                  {parent.relationToStudent ?? "Guardian"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 border border-slate-100/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm text-[10px]">📞</span>
                  <span className="text-[13px] font-bold text-slate-600">{parent.mobile ?? "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm text-[10px]">✉️</span>
                  <span className="text-[13px] font-bold text-slate-600 truncate">{parent.email ?? "N/A"}</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => navigate(`/admin/parent/${parent.id}`)}
                  className="w-full rounded-xl bg-amber-50 py-3 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-500 hover:text-white shadow-sm"
                >
                  View Full Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <span className="text-6xl mb-4">👪</span>
          <p className="text-lg font-bold text-slate-500">No parents found.</p>
        </div>
      )}
    </div>
  );
}
