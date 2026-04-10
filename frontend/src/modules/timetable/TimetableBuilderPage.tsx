import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import PageHeader from "../../components/PageHeader";
import Card from "../../components/Card";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { formatTime } from "../../utils/time";
import {
    getTimetableLockStatus,
    lockTimetable,
    unlockTimetable,
    getTimetableWorkload,
    validateTimetableSlot,
} from "../../services/api/timetable";

const DAYS = [
    { label: "MONDAY", value: 1 },
    { label: "TUESDAY", value: 2 },
    { label: "WEDNESDAY", value: 3 },
    { label: "THURSDAY", value: 4 },
    { label: "FRIDAY", value: 5 },
    { label: "SATURDAY", value: 6 },
];

type TimetableSlot = {
    id: string;
    dayOfWeek: number;
    academicYearId?: string;
    sectionId?: string;
    period?: { periodNumber: number; startTime?: string; endTime?: string; isLunch?: boolean };
    classSubjectId?: string;
    classSubject?: { class?: { id?: string; className?: string }; subject?: { id?: string; name?: string } };
    section?: { sectionName?: string; id?: string; classId?: string; class?: { id?: string; className?: string } };
    teacherId?: string | null;
    teacher?: { fullName?: string };
    periodId?: string;
    roomNo?: string | null;
};

type Section = {
    id: string;
    sectionName: string;
    classId?: string;
    classTeacherId?: string | null;
    class?: { id?: string; className?: string };
};
type ClassItem = { id: string; className?: string; academicYearId?: string; academicYear?: { id?: string }; isHalfDay?: boolean };
type SubjectItem = { id: string; name?: string };
type PeriodItem = { id: string; periodNumber: number; startTime?: string; endTime?: string; isLunch?: boolean; isFirstPeriod?: boolean };
type TimetableMeta = {
    subjects: SubjectItem[];
    teachers: Array<{ id: string; fullName?: string }>;
    classTeacherId?: string | null;
};

export default function TimetableBuilderPage() {
    const [selectedSection, setSelectedSection] = useState<string>("");
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
    const [message, setMessage] = useState<string | null>(null);
    const [slotError, setSlotError] = useState<string | null>(null);
    const [overwrite, setOverwrite] = useState(true);
    const [lockMessage, setLockMessage] = useState<string | null>(null);
    const [lockSaving, setLockSaving] = useState(false);
    const [effectiveFrom, setEffectiveFrom] = useState<string>(() => {
        return new Date().toISOString().slice(0, 10);
    });

    const { data: sections, loading: loadingSections } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 200 };
        if (selectedAcademicYearId) params.academicYearId = selectedAcademicYearId;
        const res = await api.get("/sections", { params });
        const p = res.data?.data ?? res.data;
        return (Array.isArray(p) ? p : p?.data ?? []) as Section[];
    }, [selectedAcademicYearId]);

    const { data: classes } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 200 };
        if (selectedAcademicYearId) params.academicYearId = selectedAcademicYearId;
        const res = await api.get("/classes", { params });
        const p = res.data?.data ?? res.data;
        return (Array.isArray(p) ? p : p?.data ?? []) as ClassItem[];
    }, [selectedAcademicYearId]);

    const { data: periods, loading: loadingPeriods } = useAsync(async () => {
        const params: Record<string, string | number> = { page: 1, limit: 20 };
        if (selectedAcademicYearId) params.academicYearId = selectedAcademicYearId;
        const res = await api.get("/periods", { params });
        const p = res.data?.data ?? res.data;
        const arr = (Array.isArray(p) ? p : p?.data ?? []) as PeriodItem[];
        return arr.sort((a, b) => (a?.periodNumber ?? 0) - (b?.periodNumber ?? 0));
    }, [selectedAcademicYearId]);

    const { data: lockStatus, refresh: refreshLockStatus } = useAsync(async () => {
        const res = await getTimetableLockStatus();
        return res;
    }, []);

    const { data: workload } = useAsync(async () => {
        const res = await getTimetableWorkload();
        return Array.isArray(res) ? res : [];
    }, []);

    const { data: slots, loading: loadingSlots, refresh: refreshSlots } = useAsync(async () => {
        if (!selectedSection) return [] as TimetableSlot[];
        const res = await api.get(`/timetable/section/${selectedSection}`, {
            params: effectiveFrom ? { date: effectiveFrom } : undefined,
        });
        const p = res.data?.data ?? res.data;
        const flattened: TimetableSlot[] = [];
        if (p && typeof p === "object") {
            Object.values(p).forEach((daySlots: any) => {
                (daySlots as any[]).forEach((slot) => flattened.push(slot));
            });
        }
        return flattened;
    }, [selectedSection, effectiveFrom]);

    const classById = useMemo(() => {
        const map = new Map<string, ClassItem>();
        (classes ?? []).forEach((cls) => {
            if (cls.id) map.set(cls.id, cls);
        });
        return map;
    }, [classes]);

    const filteredSections = useMemo(() => {
        if (!selectedAcademicYearId) return sections ?? [];
        return (sections ?? []).filter((section) => {
            const classId = section.classId ?? section.class?.id;
            if (!classId) return false;
            const cls = classById.get(classId);
            const yearId = cls?.academicYearId ?? cls?.academicYear?.id ?? "";
            return yearId === selectedAcademicYearId;
        });
    }, [sections, classById, selectedAcademicYearId]);

    const selectedSectionData = useMemo(() => {
        return (filteredSections ?? []).find((s) => s.id === selectedSection) ?? null;
    }, [filteredSections, selectedSection]);

    useEffect(() => {
        if (!selectedSection) return;
        const stillExists = (filteredSections ?? []).some((s) => s.id === selectedSection);
        if (!stillExists) {
            setSelectedSection("");
        }
    }, [selectedAcademicYearId, filteredSections, selectedSection]);

    const classId = selectedSectionData?.classId ?? selectedSectionData?.class?.id ?? "";
    const academicYearId =
        selectedAcademicYearId ||
        (classId && classById.get(classId)?.academicYearId) ||
        (classId && classById.get(classId)?.academicYear?.id) ||
        "";

    const { data: timetableMeta, loading: loadingMeta } = useAsync(async () => {
        if (!selectedSection) {
            return {
                subjects: [],
                teachers: [],
                classTeacherId: null,
            } as TimetableMeta;
        }
        const res = await api.get(`/admin/timetable/meta/${selectedSection}`);
        const p = res.data?.data ?? res.data;
        return (p ?? {
            subjects: [],
            teachers: [],
            classTeacherId: null,
        }) as TimetableMeta;
    }, [selectedSection]);

    const filteredSlots = useMemo(() => {
        return (slots ?? []) as TimetableSlot[];
    }, [slots]);

    const subjects = useMemo(() => {
        return (timetableMeta?.subjects ?? []) as SubjectItem[];
    }, [timetableMeta]);

    const teachers = useMemo(() => {
        return (timetableMeta?.teachers ?? []) as Array<{ id: string; fullName?: string }>;
    }, [timetableMeta]);

    useEffect(() => {
        if (!selectedSection) return;
        if (import.meta.env.MODE !== "production") {
            console.log("Subjects:", subjects.length);
            console.log("Teachers:", teachers.length);
        }
    }, [selectedSection, subjects.length, teachers.length]);

    const isLoading = loadingSections || loadingPeriods || loadingMeta;
    const locked = Boolean((lockStatus as any)?.locked);

    const [savingGrid, setSavingGrid] = useState(false);
    const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
    const [gridState, setGridState] = useState<Record<string, { subjectId: string; teacherId: string }>>({});

    useEffect(() => {
        if (!selectedSection || !periods?.length) {
            setGridState({});
            return;
        }
        const next: Record<string, { subjectId: string; teacherId: string }> = {};
        (filteredSlots ?? []).forEach((slot) => {
            if (slot.dayOfWeek && slot.periodId) {
                const key = `${slot.dayOfWeek}:${slot.periodId}`;
                next[key] = {
                    subjectId: slot.classSubject?.subject?.id ?? "",
                    teacherId: slot.teacherId ?? "",
                };
            }
        });
        setGridState(next);
    }, [selectedSection, periods, filteredSlots]);

    const classTeacherId = timetableMeta?.classTeacherId ?? selectedSectionData?.classTeacherId ?? "";
    const isHalfDay = Boolean(classId && classById.get(classId)?.isHalfDay);
    const visiblePeriods = useMemo(() => {
        const list = (periods ?? []).slice();
        list.sort((a, b) => (a?.periodNumber ?? 0) - (b?.periodNumber ?? 0));
        if (!isHalfDay) return list;
        const maxPeriod = list.reduce((max, p) => Math.max(max, p?.periodNumber ?? 0), 0);
        const cutoff = Math.ceil(maxPeriod / 2);
        return list.filter((p) => (p?.periodNumber ?? 0) <= cutoff);
    }, [periods, isHalfDay]);

    const handleCellChange = async (
        dayOfWeek: number,
        period: PeriodItem,
        subjectId: string,
        teacherId: string
    ) => {
        if (locked) return;
        const key = `${dayOfWeek}:${period.id}`;
        setGridState((prev) => ({
            ...prev,
            [key]: { subjectId, teacherId },
        }));

        if (!selectedSection || !academicYearId || !subjectId || !teacherId) {
            return;
        }

        try {
            const result = await validateTimetableSlot({
                academicYearId,
                sectionId: selectedSection,
                dayOfWeek,
                periodId: period.id,
                subjectId,
                teacherId,
                effectiveFrom,
            });
            if (result?.hasConflict) {
                setCellErrors((prev) => ({
                    ...prev,
                    [key]: result.reason ?? "Conflict detected",
                }));
            } else {
                setCellErrors((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        } catch (err: any) {
            setCellErrors((prev) => ({
                ...prev,
                [key]: err?.response?.data?.message ?? "Conflict detected",
            }));
        }
    };

    const handleSaveGrid = async () => {
        setMessage(null);
        setSlotError(null);
        if (locked) {
            setSlotError("Timetable is locked.");
            return;
        }
        if (!selectedSection) {
            setSlotError("Select a section first.");
            return;
        }
        if (!academicYearId) {
            setSlotError("Academic year not found for this class.");
            return;
        }
        const periodFirstMap = new Map<string, boolean>();
        (periods ?? []).forEach((p) => {
            if (p?.id) periodFirstMap.set(p.id, Boolean(p.isFirstPeriod));
        });
        const visiblePeriodIds = new Set(visiblePeriods.map((p) => p.id));
        const slotsPayload = Object.entries(gridState)
            .filter(([key, value]) => {
                const [, periodId] = key.split(":");
                if (!visiblePeriodIds.has(periodId)) return false;
                return value.subjectId && (value.teacherId || classTeacherId);
            })
            .map(([key, value]) => {
                const [day, periodId] = key.split(":");
                const isFirst = periodFirstMap.get(periodId) ?? false;
                return {
                    dayOfWeek: Number(day),
                    periodId,
                    subjectId: value.subjectId,
                    teacherId: isFirst ? classTeacherId : value.teacherId,
                };
            });
        if (!slotsPayload.length) {
            setSlotError("Add at least one timetable slot.");
            return;
        }
        setSavingGrid(true);
        try {
            await api.post("/admin/timetable/bulk-create", {
                academicYearId,
                sectionId: selectedSection,
                slots: slotsPayload,
                effectiveFrom,
                overwrite,
            });
            setMessage("Timetable saved successfully.");
            refreshSlots();
        } catch (err: any) {
            setSlotError(err?.response?.data?.message ?? "Failed to save timetable.");
        } finally {
            setSavingGrid(false);
        }
    };

    const handleToggleLock = async () => {
        setLockMessage(null);
        setLockSaving(true);
        try {
            if (locked) {
                await unlockTimetable();
                setLockMessage("Timetable unlocked.");
            } else {
                await lockTimetable();
                setLockMessage("Timetable locked.");
            }
            refreshLockStatus();
        } catch (err: any) {
            setLockMessage(err?.response?.data?.message ?? "Failed to update lock.");
        } finally {
            setLockSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-slide-up">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <PageHeader title="Timetable Builder" subtitle="Visual grid for scheduling sections" />
                <AcademicYearFilter
                    value={selectedAcademicYearId}
                    onChange={setSelectedAcademicYearId}
                    syncQueryKey="academicYearId"
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-ink-600">Section:</label>
                <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink-900 transition focus:border-jade-400 focus:ring-2 focus:ring-jade-100"
                >
                    <option value="">Select a section</option>
                    {(filteredSections ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.class?.className ?? "?"} - {s.sectionName}
                        </option>
                    ))}
                </select>
                <label className="text-sm font-medium text-ink-600">Effective From:</label>
                <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 transition focus:border-jade-400 focus:ring-2 focus:ring-jade-100"
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button variant={locked ? "secondary" : "primary"} onClick={handleToggleLock} disabled={lockSaving}>
                    {lockSaving ? "Saving..." : locked ? "Unlock Timetable" : "Lock Timetable"}
                </Button>
                {locked && <span className="text-xs text-sunrise-600">Editing is disabled while locked.</span>}
                {lockMessage && <span className="text-xs text-ink-500">{lockMessage}</span>}
            </div>

            {message && <p className="text-sm text-jade-600">{message}</p>}
            <div className="flex items-center gap-2 text-xs text-ink-600">
                <input
                    id="overwrite-toggle"
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    disabled={locked}
                />
                <label htmlFor="overwrite-toggle">Overwrite existing timetable</label>
            </div>
            {selectedSection && (subjects.length === 0 || teachers.length === 0) && (
                <p className="text-xs text-sunrise-600">No subjects or teachers assigned</p>
            )}

            {isLoading ? (
                <LoadingState label="Loading timetable data..." />
            ) : !selectedSection ? (
                <Card>
                    <EmptyState
                        title="Select a section"
                        description="Choose a class-section above to view or edit its timetable."
                    />
                </Card>
            ) : loadingSlots ? (
                <LoadingState label="Loading timetable..." />
            ) : (
                <Card noPadding>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-ink-50/50">
                                    <th className="sticky left-0 bg-ink-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                        Period
                                    </th>
                                    {DAYS.map((day) => (
                                        <th key={day.value} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
                                            {day.label.slice(0, 3)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-50">
                                {visiblePeriods.map((period) => {
                                    if (!period) return null;
                                    return (
                                        <tr key={period.periodNumber} className={period.isLunch ? "bg-sunrise-50/30" : ""}>
                                            <td className="sticky left-0 bg-white px-3 py-3 font-medium text-ink-700 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{period.isLunch ? "Lunch" : `P${period.periodNumber}`}</span>
                                                    <span className="text-[10px] text-ink-400">
                                                        {formatTime(period.startTime)} - {formatTime(period.endTime)}
                                                    </span>
                                                </div>
                                            </td>
                                            {DAYS.map((day) => {
                                                if (period.isLunch) {
                                                    return (
                                                        <td key={day.value} className="px-2 py-2 text-center text-xs text-ink-400">
                                                            —
                                                        </td>
                                                    );
                                                }
                                                const key = `${day.value}:${period.id}`;
                                                const state = gridState[key] ?? { subjectId: "", teacherId: "" };
                                                const isFirstPeriod = Boolean(period.isFirstPeriod);
                                                const teacherId = isFirstPeriod ? classTeacherId : state.teacherId;
                                                const availableTeachers = teachers;
                                                const classTeacherOption =
                                                    isFirstPeriod && classTeacherId && !teachers.some((t) => t.id === classTeacherId)
                                                        ? { id: classTeacherId, fullName: "Class Teacher" }
                                                        : null;
                                                const subjectSelectDisabled = locked;
                                                const teacherSelectDisabled = locked || isFirstPeriod;
                                                return (
                                                    <td key={day.value} className="px-2 py-2 align-top">
                                                        <div
                                                            className={`flex flex-col gap-2 rounded-lg border ${
                                                                cellErrors[key] ? "border-sunrise-500" : "border-ink-200"
                                                            } bg-white p-2`}
                                                            title={cellErrors[key] ?? ""}
                                                        >
                                                            <select
                                                                className="w-full rounded-md border border-ink-100 px-2 py-1 text-xs"
                                                                value={state.subjectId}
                                                                onChange={(e) =>
                                                                    handleCellChange(day.value, period, e.target.value, teacherId)
                                                                }
                                                                disabled={subjectSelectDisabled}
                                                            >
                                                                {subjects.length ? (
                                                                    <>
                                                                        <option value="">Select Subject</option>
                                                                        {subjects.map((subject) => (
                                                                            <option key={subject.id} value={subject.id}>
                                                                                {subject.name ?? "Subject"}
                                                                            </option>
                                                                        ))}
                                                                    </>
                                                                ) : (
                                                                    <option value="">No subjects</option>
                                                                )}
                                                            </select>
                                                            <select
                                                                className="w-full rounded-md border border-ink-100 px-2 py-1 text-xs"
                                                                value={teacherId}
                                                                onChange={(e) =>
                                                                    handleCellChange(day.value, period, state.subjectId, e.target.value)
                                                                }
                                                                disabled={teacherSelectDisabled}
                                                            >
                                                                {availableTeachers.length || classTeacherOption ? (
                                                                    <>
                                                                        <option value="">Select Teacher</option>
                                                                        {classTeacherOption && (
                                                                            <option key={classTeacherOption.id} value={classTeacherOption.id}>
                                                                                {classTeacherOption.fullName}
                                                                            </option>
                                                                        )}
                                                                        {availableTeachers.map((teacher) => (
                                                                            <option key={teacher.id} value={teacher.id}>
                                                                                {teacher.fullName ?? "Teacher"}
                                                                            </option>
                                                                        ))}
                                                                    </>
                                                                ) : (
                                                                    <option value="">No teachers</option>
                                                                )}
                                                            </select>
                                                            {cellErrors[key] && (
                                                                <p className="text-[10px] text-sunrise-600">{cellErrors[key]}</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-ink-100 p-4">
                        {slotError && <p className="text-xs text-sunrise-600">{slotError}</p>}
                        {message && <p className="text-xs text-jade-600">{message}</p>}
                        <Button onClick={handleSaveGrid} disabled={savingGrid || locked}>
                            {savingGrid ? "Saving..." : "Save Timetable"}
                        </Button>
                    </div>
                </Card>
            )}

            <Card title="Teacher Workload">
                {workload?.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                                    <th className="py-2">Teacher</th>
                                    <th className="py-2">Total Periods</th>
                                    <th className="py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-50">
                                {workload.map((row: any) => (
                                    <tr key={row.teacherId} className={row.isOverloaded ? "bg-sunrise-50/50" : ""}>
                                        <td className="py-2 text-ink-700">{row.teacherName ?? "Teacher"}</td>
                                        <td className="py-2 text-ink-700">{row.totalPeriods}</td>
                                        <td className={`py-2 text-xs font-semibold ${row.isOverloaded ? "text-sunrise-600" : "text-jade-600"}`}>
                                            {row.isOverloaded ? "Overloaded" : "OK"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No workload data" description="Create a timetable to view teacher workload." />
                )}
            </Card>
        </div>
    );
}
