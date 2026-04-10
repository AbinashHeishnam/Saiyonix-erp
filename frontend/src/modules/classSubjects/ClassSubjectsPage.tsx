import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type ClassItem = { id: string; className: string; classOrder?: number };
type SubjectItem = { id: string; name: string; code?: string };

export default function ClassSubjectsPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const { data: classes, loading: loadingClasses, refresh: refreshClasses } = useAsync(async () => {
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, [academicYearId]);

  const { data: subjects, loading: loadingSubjects, error: subjectsError } = useAsync(async () => {
    const res = await api.get("/subjects", { params: { page: 1, limit: 200 } });
    const p = res.data?.data ?? res.data;
    return Array.isArray(p) ? p : p?.data ?? [];
  }, []);

  const classItems = useMemo(() => (Array.isArray(classes) ? classes : []), [classes]);
  const subjectItems = useMemo(() => (Array.isArray(subjects) ? subjects : []), [subjects]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!selectedClassId) return;
    const exists = classItems.some((cls: ClassItem) => cls.id === selectedClassId);
    if (!exists) {
      setSelectedClassId("");
      setSelectedSubjectIds([]);
    }
  }, [academicYearId, classItems, selectedClassId]);

  const { data: classConfig, loading: loadingConfig, refresh: refreshConfig } = useAsync(async () => {
    if (!selectedClassId) return { subjectIds: [] as string[] };
    const res = await api.get("/admin/class-subjects", { params: { classId: selectedClassId } });
    return res.data?.data ?? res.data;
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setSelectedSubjectIds([]);
      return;
    }
    const ids = (classConfig?.subjectIds ?? []) as string[];
    setSelectedSubjectIds(ids);
  }, [classConfig, selectedClassId]);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSave = async () => {
    if (!selectedClassId) {
      setError("Select a class first.");
      return;
    }
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await api.post("/admin/class-subjects", {
        classId: selectedClassId,
        subjectIds: selectedSubjectIds,
      });
      setMessage("Class subjects updated.");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update class subjects."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!academicYearId) {
      setError("Select an academic year first.");
      return;
    }
    setError(null);
    setMessage(null);
    setCopying(true);
    try {
      const res = await api.post("/admin/class-subjects/copy-from-previous-year", {
        targetAcademicYearId: academicYearId,
      });
      const summary = res.data?.data ?? res.data;
      setMessage(
        `Copied mappings for ${summary?.classesMatched ?? 0} classes. ` +
          `${summary?.mappingsCreated ?? 0} mappings created, ` +
          `${summary?.mappingsSkipped ?? 0} skipped.`
      );
      await refreshClasses();
      await refreshConfig();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to copy class subjects."
      );
    } finally {
      setCopying(false);
    }
  };

  const isLoading = loadingClasses || loadingSubjects || loadingConfig;

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="Class Subjects" subtitle="Select subjects for each class" />
      <div className="flex flex-wrap items-center gap-3">
        <AcademicYearFilter
          value={academicYearId}
          onChange={setAcademicYearId}
          syncQueryKey="academicYearId"
        />
        <Button
          variant="secondary"
          onClick={handleCopyFromPreviousYear}
          disabled={!academicYearId || copying}
        >
          {copying ? "Copying..." : "Same as Previous Year"}
        </Button>
        <Select
          label="Class"
          value={selectedClassId}
          onChange={(event) => setSelectedClassId(event.target.value)}
        >
          <option value="">Select class</option>
          {classItems.map((cls: ClassItem) => (
            <option key={cls.id} value={cls.id}>
              {cls.className}
            </option>
          ))}
        </Select>
        <Button onClick={handleSave} disabled={saving || !selectedClassId}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {message && <p className="text-sm text-jade-600">{message}</p>}
      {error && <p className="text-sm text-sunrise-600">{error}</p>}
      {subjectsError && <p className="text-sm text-sunrise-600">{subjectsError}</p>}

      {isLoading ? (
        <LoadingState label="Loading subjects..." />
      ) : !selectedClassId ? (
        <Card>
          <EmptyState
            title="Select a class"
            description="Choose a class to configure subjects."
          />
        </Card>
      ) : subjectItems.length === 0 ? (
        <Card>
          <EmptyState
            title="No subjects"
            description="Create subjects first to configure class subjects."
          />
        </Card>
      ) : (
        <Card title="Subjects">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjectItems.map((subject: SubjectItem) => {
              const checked = selectedSubjectIds.includes(subject.id);
              return (
                <label
                  key={subject.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                    checked ? "border-jade-200 bg-jade-50/70" : "border-ink-100 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSubject(subject.id)}
                  />
                  <span className="text-ink-700">
                    {subject.name} {subject.code ? `(${subject.code})` : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
