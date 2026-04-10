import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import Select from "../../components/Select";
import SecureImage from "../../components/SecureImage";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type Student = {
    id: string;
    fullName: string;
    registrationNumber?: string;
    admissionNumber?: string;
    status?: string;
    profile?: { profilePhotoUrl?: string | null } | null;
    enrollments?: Array<{
        class?: { className?: string };
        section?: { sectionName?: string };
        rollNumber?: number;
    }>;
};

type ClassItem = { id: string; className: string };
type SectionItem = { id: string; sectionName: string; classId: string };

function getInitials(name?: string) {
    if (!name) return "S";
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
}

export default function StudentsPage() {
    const navigate = useNavigate();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState({ classId: "", sectionId: "" });
    const [appliedFilters, setAppliedFilters] = useState({ classId: "", sectionId: "" });
    const [academicYearId, setAcademicYearId] = useState("");
    const [query, setQuery] = useState("");
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const { data, loading, error, refresh } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 100 };
        if (academicYearId) params.academicYearId = academicYearId;
        if (appliedFilters.classId) params.classId = appliedFilters.classId;
        if (appliedFilters.sectionId) params.sectionId = appliedFilters.sectionId;
        const res = await api.get("/students", { params });
        const payload = res.data?.data ?? res.data;
        const students = payload?.students ?? payload?.data ?? payload;
        return Array.isArray(students) ? students : students?.data ?? [];
    }, [appliedFilters.classId, appliedFilters.sectionId, academicYearId]);

    const { data: classes } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 100 };
        if (academicYearId) params.academicYearId = academicYearId;
        const res = await api.get("/classes", { params });
        const payload = res.data?.data ?? res.data;
        return Array.isArray(payload) ? payload : payload?.data ?? [];
    }, [academicYearId]);

    const { data: sections } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 200 };
        if (academicYearId) params.academicYearId = academicYearId;
        if (filters.classId) params.classId = filters.classId;
        const res = await api.get("/sections", { params });
        const payload = res.data?.data ?? res.data;
        return Array.isArray(payload) ? payload : payload?.data ?? [];
    }, [academicYearId, filters.classId]);

    const classOptions = useMemo(
        () => (Array.isArray(classes) ? (classes as ClassItem[]) : []),
        [classes]
    );

    const sectionOptions = useMemo(() => {
        const allSections = Array.isArray(sections) ? (sections as SectionItem[]) : [];
        if (!filters.classId) return allSections;
        return allSections.filter((item) => item.classId === filters.classId);
    }, [sections, filters.classId]);

    const classIds = useMemo(
        () => new Set(classOptions.map((item) => item.id)),
        [classOptions]
    );
    const sectionIds = useMemo(
        () => new Set(sectionOptions.map((item) => item.id)),
        [sectionOptions]
    );

    useEffect(() => {
        if (filters.classId && !classIds.has(filters.classId)) {
            setFilters((prev) => ({ ...prev, classId: "", sectionId: "" }));
            setAppliedFilters((prev) => ({ ...prev, classId: "", sectionId: "" }));
        }
        if (filters.sectionId && !sectionIds.has(filters.sectionId)) {
            setFilters((prev) => ({ ...prev, sectionId: "" }));
            setAppliedFilters((prev) => ({ ...prev, sectionId: "" }));
        }
    }, [classIds, sectionIds, filters.classId, filters.sectionId]);

    const items = useMemo(() => {
        const list = (data ?? []) as Student[];
        if (!query.trim()) return list;
        const q = query.trim().toLowerCase();
        return list.filter((s) =>
            [
                s.fullName,
                s.registrationNumber,
                s.admissionNumber,
                s.status,
                s.enrollments?.[0]?.class?.className,
                s.enrollments?.[0]?.section?.sectionName,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(q))
        );
    }, [data, query]);

    const handleAssignRolls = async () => {
        setActionMessage(null);
        setActionError(null);
        if (!appliedFilters.sectionId && !appliedFilters.classId) {
            setActionError("Select a class or section to assign roll numbers.");
            return;
        }
        try {
            if (appliedFilters.sectionId) {
                const res = await api.post(`/admin/sections/${appliedFilters.sectionId}/assign-rolls`);
                const count = res.data?.data?.assignedCount ?? 0;
                setActionMessage(count ? `Assigned ${count} roll number(s).` : "No pending roll numbers.");
            } else if (appliedFilters.classId) {
                const res = await api.post(`/admin/classes/${appliedFilters.classId}/assign-rolls`);
                const count = res.data?.data?.assignedCount ?? 0;
                setActionMessage(count ? `Assigned ${count} roll number(s).` : "No pending roll numbers.");
            }
            await refresh();
        } catch (err: unknown) {
            setActionError(
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to assign roll numbers."
            );
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-12">

            {/* Premium Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Student Roster</h1>
                    <p className="text-sm font-semibold text-slate-500 mt-1">Manage global student profiles, enrollments, and academic tracking.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => navigate("/admin/students/imports")} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                        Bulk Import
                    </Button>
                    <Button onClick={() => navigate("/admin/students/photos")} variant="secondary" className="shadow-sm">
                        Photos
                    </Button>
                </div>
            </div>

            {/* Smart Floating Filter Dock */}
            <div className="sticky top-20 z-20 flex flex-col gap-4 bg-white/90 backdrop-blur-xl shadow-soft border border-slate-200 rounded-2xl p-3 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg className="h-4.5 w-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search pupils by name, registration, or class..."
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border-0 ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="w-[140px] sm:w-[160px]">
                            <AcademicYearFilter
                                value={academicYearId}
                                onChange={(value) => {
                                    setAcademicYearId(value);
                                    setFilters({ classId: "", sectionId: "" });
                                    setAppliedFilters({ classId: "", sectionId: "" });
                                }}
                                syncQueryKey="academicYearId"
                            />
                        </div>
                        <div className="hidden lg:flex h-11 items-center px-4 rounded-xl bg-slate-50 border border-slate-200 border-dashed">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                {items.length} {items.length === 1 ? 'Pupil' : 'Pupils'}
                            </span>
                        </div>
                        <button
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            className={`flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-all border ${filtersOpen
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filters
                        </button>
                    </div>
                </div>

                {filtersOpen && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-3 border-t border-slate-100 animate-slide-up">
                        <Select
                            label="Academic Class"
                            value={filters.classId}
                            onChange={(e) => {
                                const nextClassId = e.target.value;
                                setFilters((prev) => ({
                                    ...prev,
                                    classId: nextClassId,
                                    sectionId: nextClassId ? prev.sectionId : "",
                                }));
                            }}
                        >
                            <option value="">All Classes</option>
                            {classOptions.map((item) => (
                                <option key={item.id} value={item.id}>{item.className}</option>
                            ))}
                        </Select>

                        <Select
                            label="Section"
                            value={filters.sectionId}
                            onChange={(e) => setFilters((prev) => ({ ...prev, sectionId: e.target.value }))}
                        >
                            <option value="">All Sections</option>
                            {sectionOptions.map((item) => (
                                <option key={item.id} value={item.id}>{item.sectionName}</option>
                            ))}
                        </Select>

                        <div className="flex items-end gap-2 pb-0.5">
                            <Button
                                onClick={() => { setAppliedFilters(filters); refresh(); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                Apply
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setFilters({ classId: "", sectionId: "" });
                                    setAppliedFilters({ classId: "", sectionId: "" });
                                    refresh();
                                }}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

                {/* Bulk Actions Row */}
                {filtersOpen && (actionMessage || actionError || appliedFilters.classId) && (
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                onClick={handleAssignRolls}
                                disabled={!appliedFilters.classId && !appliedFilters.sectionId}
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs"
                            >
                                Auto Assign Roll Numbers
                            </Button>
                        </div>
                        <div className="text-sm font-bold">
                            {actionMessage && <p className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">{actionMessage}</p>}
                            {actionError && <p className="text-rose-600 bg-rose-50 px-3 py-1 rounded-md">{actionError}</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
                    <p className="text-sm font-bold text-rose-600">{error}</p>
                </div>
            ) : items.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((student) => {
                        const statusLabel = (student as { statusLabel?: string | null }).statusLabel ?? student.status ?? "—";
                        const badgeVariant =
                            statusLabel === "ACTIVE"
                                ? "success"
                                : statusLabel === "TC GIVEN"
                                    ? "warning"
                                    : statusLabel === "EXPELLED"
                                        ? "danger"
                                        : "neutral";
                        return (
                            <div
                                key={student.id}
                                className="group relative flex flex-col justify-between rounded-3xl bg-white border border-slate-100 p-6 shadow-sm transition-all hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-emerald-100"
                            >
                                <div className="absolute top-4 right-4 z-10">
                                    <StatusBadge variant={badgeVariant} dot={true}>
                                        {statusLabel}
                                    </StatusBadge>
                                </div>

                                <div className="flex flex-col items-center text-center mt-2">
                                    <div className="relative">
                                        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-100 to-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
                                        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-2xl font-black text-white shadow-md ring-4 ring-white">
                                            {student.profile?.profilePhotoUrl ? (
                                                <SecureImage
                                                    fileUrl={student.profile.profilePhotoUrl}
                                                    alt={student.fullName}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                getInitials(student.fullName)
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="mt-4 text-lg font-bold text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">
                                        {student.fullName}
                                    </h3>
                                    <p className="text-[12px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-2">
                                        {student.enrollments?.[0]?.class?.className ?? "N/A"} • {student.enrollments?.[0]?.section?.sectionName ?? "N/A"}
                                    </p>
                                </div>

                                <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-slate-50 border border-slate-100/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Roll No</span>
                                        <span className="text-[13px] font-black text-slate-700 px-2 py-0.5 bg-white rounded-md shadow-sm border border-slate-100">
                                            {student.enrollments?.[0]?.rollNumber ?? "Pending"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Reg No</span>
                                        <span className="text-[12px] font-bold text-slate-600">{student.registrationNumber ?? "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adm No</span>
                                        <span className="text-[12px] font-bold text-slate-600">{student.admissionNumber ?? "—"}</span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        onClick={() => navigate(`/admin/student/${student.id}`)}
                                        className="w-full rounded-xl bg-slate-50 border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-emerald-600 hover:border-emerald-600 hover:text-white"
                                    >
                                        Profile & Records
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <span className="text-6xl mb-4">🎓</span>
                    <p className="text-lg font-bold text-slate-500">No students match criteria.</p>
                </div>
            )}
        </div>
    );
}
