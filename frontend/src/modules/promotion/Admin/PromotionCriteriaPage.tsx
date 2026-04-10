import { useEffect, useMemo, useState } from "react";

import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Input from "../../../components/Input";
import Select from "../../../components/Select";
import Button from "../../../components/Button";
import StatCard from "../../../components/StatCard";
import { useAsync } from "../../../hooks/useAsync";
import api, { safeApiCall } from "../../../services/api/client";
import {
  applyFinalPromotion,
  assignRollNumbers,
  generatePromotion,
  getRollNumberAssignmentStatus,
  publishPromotion,
  type PromotionPreviewRecord,
} from "../../../services/api/promotion";
import { listExams, type Exam } from "../../../services/api/exams";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ConfirmationModal from "../components/ConfirmationModal";

type AcademicYear = {
  id: string;
  label: string;
  isActive?: boolean;
  isLocked?: boolean;
  startDate?: string;
};

type ClassItem = {
  id: string;
  className: string;
  academicYearId?: string;
};

type ExamCoverageRow = {
  classId: string;
  className: string;
  examCount: number;
  hasFinal: boolean;
};

type PromotionCriteria = {
  academicYearId: string;
  minAttendancePercent: number;
  minSubjectPassCount: number;
  allowUnderConsideration?: boolean;
};

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeExamList(payload: any): Exam[] {
  if (Array.isArray(payload)) return payload as Exam[];
  if (Array.isArray(payload?.items)) return payload.items as Exam[];
  if (Array.isArray(payload?.data?.items)) return payload.data.items as Exam[];
  if (Array.isArray(payload?.data)) return payload.data as Exam[];
  return [];
}

export default function PromotionCriteriaPage() {
  const {
    data: academicYearData,
    loading: yearLoading,
    refresh: refreshYears,
  } = useAsync(async () => {
    const res = await api.get("/academic-years", { params: { page: 1, limit: 50 } });
    return res.data?.data ?? res.data;
  }, []);

  const academicYears = useMemo(
    () => normalizeList<AcademicYear>(academicYearData),
    [academicYearData]
  );

  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0],
    [academicYears]
  );

  const [academicYearId, setAcademicYearId] = useState("");
  const [attendance, setAttendance] = useState("");
  const [failedAllowed, setFailedAllowed] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [promoteBy, setPromoteBy] = useState<"RANK" | "PERCENTAGE">("PERCENTAGE");
  const [publishing, setPublishing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyingFinal, setApplyingFinal] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [examId, setExamId] = useState("");
  const [previewRecords, setPreviewRecords] = useState<PromotionPreviewRecord[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [examCoverage, setExamCoverage] = useState<ExamCoverageRow[]>([]);
  const [examCoverageLoading, setExamCoverageLoading] = useState(false);
  const [examCoverageError, setExamCoverageError] = useState<string | null>(null);
  const [assigningRolls, setAssigningRolls] = useState(false);
  const [rollStatus, setRollStatus] = useState<{
    totalEnrollments: number;
    pendingCount: number;
    hasStudents: boolean;
    hasPending: boolean;
  } | null>(null);

  useEffect(() => {
    if (!academicYearId && activeYear?.id) {
      setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, activeYear]);

  useEffect(() => {
    if (!academicYears.length) return;
    if (!academicYearId) return;
    if (!toAcademicYearId || toAcademicYearId === academicYearId) {
      const fromYear = academicYears.find((y) => y.id === academicYearId);
      const fromDate = fromYear?.startDate ? new Date(fromYear.startDate).getTime() : null;
      const candidates = academicYears
        .filter((y) => y.id !== academicYearId)
        .sort((a, b) => {
          const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
          return ad - bd;
        });
      const nextYear = fromDate
        ? candidates.find((y) => (y.startDate ? new Date(y.startDate).getTime() : 0) > fromDate)
        : candidates[0];
      setToAcademicYearId(nextYear?.id ?? "");
    }
  }, [academicYears, academicYearId, toAcademicYearId]);

  useEffect(() => {
    if (!toAcademicYearId) {
      setRollStatus(null);
      return;
    }
    getRollNumberAssignmentStatus(toAcademicYearId)
      .then((data) => setRollStatus(data))
      .catch(() => setRollStatus(null));
  }, [toAcademicYearId]);

  useEffect(() => {
    setExamId("");
    setPreviewRecords([]);
    setPreviewError(null);
  }, [academicYearId, toAcademicYearId, promoteBy]);

  useEffect(() => {
    let active = true;
    const loadCoverage = async () => {
      if (!academicYearId) {
        setExamCoverage([]);
        return;
      }
      setExamCoverageLoading(true);
      setExamCoverageError(null);
      try {
        const res = await api.get("/classes", {
          params: { page: 1, limit: 200, academicYearId },
        });
        const yearClasses = normalizeList<ClassItem>(res.data?.data ?? res.data);

        const results = await Promise.all(
          yearClasses.map(async (cls) => {
            const examsRes = await listExams({
              academicYearId,
              classId: cls.id,
              page: 1,
              limit: 200,
            });
            const examsPayload = examsRes?.data ?? examsRes;
            const exams = normalizeExamList(examsPayload);
            return {
              classId: cls.id,
              className: cls.className,
              examCount: exams.length,
              hasFinal: exams.some((exam) => exam.isFinalExam),
            } as ExamCoverageRow;
          })
        );

        if (active) {
          setExamCoverage(results);
        }
      } catch (err: any) {
        if (active) {
          setExamCoverageError(err?.response?.data?.message ?? "Failed to load exam coverage");
        }
      } finally {
        if (active) setExamCoverageLoading(false);
      }
    };

    void loadCoverage();
    return () => {
      active = false;
    };
  }, [academicYearId]);

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!academicYearId) return null;
    const res = await api.get("/promotion/criteria", { params: { academicYearId } });
    return res.data?.data ?? res.data;
  }, [academicYearId]);

  const { data: examData } = useAsync(async () => {
    if (!academicYearId) return [] as Exam[];
    const res = await listExams({ academicYearId, page: 1, limit: 200 });
    const payload = res?.data ?? res;
    return normalizeList<Exam>(payload);
  }, [academicYearId]);

  const finalExams = useMemo(
    () => normalizeList<Exam>(examData).filter((e) => e.isFinalExam),
    [examData]
  );

  const summary = useMemo(() => {
    const total = previewRecords.length;
    const eligible = previewRecords.filter((r) => r.status === "ELIGIBLE").length;
    const failed = previewRecords.filter((r) => r.status === "FAILED").length;
    return { total, eligible, failed };
  }, [previewRecords]);

  useEffect(() => {
    if (!data) {
      setAttendance("");
      setFailedAllowed("");
      return;
    }
    const criteria = data as PromotionCriteria;
    if (criteria?.minAttendancePercent !== undefined) {
      setAttendance(String(criteria.minAttendancePercent));
    }
    if (criteria?.minSubjectPassCount !== undefined) {
      setFailedAllowed(String(criteria.minSubjectPassCount));
    }
  }, [data]);

  const handleSave = async () => {
    setFormError(null);

    const attendanceValue = Number(attendance);
    const failedValue = Number(failedAllowed);

    if (Number.isNaN(attendanceValue) || attendanceValue < 0 || attendanceValue > 100) {
      setFormError("Attendance must be between 0 and 100.");
      return;
    }
    if (Number.isNaN(failedValue) || failedValue < 0) {
      setFormError("Failed subjects allowed must be 0 or more.");
      return;
    }
    if (!academicYearId) {
      setFormError("Select an academic year.");
      return;
    }

    setSaving(true);
    try {
      await safeApiCall(
        () =>
          api.post("/promotion/criteria", {
            academicYearId,
            minAttendancePercent: attendanceValue,
            minSubjectPassCount: failedValue,
          }),
        { loading: "Saving criteria...", success: "Promotion criteria saved" }
      );
      refresh();
    } catch {
      // handled by toast
    } finally {
      setSaving(false);
    }
  };

  const sameYearSelected =
    !!academicYearId && !!toAcademicYearId && academicYearId === toAcademicYearId;
  const selectedFrom = academicYears.find((y) => y.id === academicYearId);
  const fromLocked = Boolean(selectedFrom?.isLocked);
  const criteriaExists = Boolean((data as { id?: string } | null | undefined)?.id);
  const canPublish =
    !previewLoading &&
    !publishing &&
    !fromLocked &&
    !sameYearSelected &&
    criteriaExists &&
    !!academicYearId &&
    !!toAcademicYearId;
  const canApplyFinal =
    !previewLoading &&
    !applyingFinal &&
    !fromLocked &&
    !sameYearSelected &&
    criteriaExists &&
    !!academicYearId &&
    !!toAcademicYearId;

  const handleGeneratePreview = async () => {
    if (!academicYearId || !examId || fromLocked || sameYearSelected) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await generatePromotion({ academicYearId, examId });
      setPreviewRecords(normalizeList<PromotionPreviewRecord>(res));
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message ?? "Something went wrong");
      setPreviewRecords([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await safeApiCall(
        () =>
          publishPromotion({
            fromAcademicYearId: academicYearId,
            toAcademicYearId,
            promoteBy,
          }),
        { loading: "Publishing promotions...", success: "Promotion published" }
      );
      await handleGeneratePreview();
    } catch {
      // handled by toast
    } finally {
      setPublishing(false);
      setConfirmOpen(false);
    }
  };

  const handleApplyFinal = async () => {
    if (!canApplyFinal) return;
    setApplyingFinal(true);
    try {
      await safeApiCall(
        () =>
          applyFinalPromotion({
            fromAcademicYearId: academicYearId,
            toAcademicYearId,
            promoteBy,
          }),
        { loading: "Applying final promotion...", success: "Promotion applied" }
      );
      refreshYears();
      await handleGeneratePreview();
    } catch {
      // handled by toast
    } finally {
      setApplyingFinal(false);
      setApplyConfirmOpen(false);
    }
  };

  const handleAssignRollNumbers = async () => {
    if (!toAcademicYearId) return;
    setAssigningRolls(true);
    try {
      await safeApiCall(
        () => assignRollNumbers(toAcademicYearId),
        { loading: "Assigning roll numbers...", success: "Roll numbers assigned" }
      );
      const data = await getRollNumberAssignmentStatus(toAcademicYearId);
      setRollStatus(data);
    } catch {
      // handled by toast
    } finally {
      setAssigningRolls(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Promotion Criteria"
        subtitle="Define promotion requirements for the academic year."
      />

      <Card title="Criteria Settings" subtitle="Set minimum requirements for promotion.">
        {yearLoading ? (
          <Loader label="Loading academic years..." />
        ) : academicYears.length === 0 ? (
          <EmptyState
            title="No academic years"
            description="Create an academic year before setting promotion criteria."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Select
              label="Academic Year"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              <option value="">Select year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </Select>

            {loading ? (
              <Loader label="Loading criteria..." />
            ) : error ? (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : !data ? (
              <div className="rounded-2xl border border-sunrise-200 bg-sunrise-50/60 p-4 text-sm text-sunrise-700">
                Criteria not set for this academic year. Set the values below to enable promotions.
              </div>
            ) : (
              <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 text-sm text-ink-600">
                Criteria last saved for this academic year. Update values below to override.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Minimum Attendance (%)"
                type="number"
                min={0}
                max={100}
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
                placeholder="e.g. 75"
                disabled={criteriaExists}
              />
              <Input
                label="Maximum Failed Subjects Allowed"
                type="number"
                min={0}
                value={failedAllowed}
                onChange={(e) => setFailedAllowed(e.target.value)}
                placeholder="e.g. 2"
                helper="Mapped to backend pass-count rule."
                disabled={criteriaExists}
              />
            </div>

            {formError && <p className="text-sm font-medium text-rose-600">{formError}</p>}

            <div className="flex items-center justify-end">
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={saving || !academicYearId || criteriaExists}
              >
                Save Criteria
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Promotion Publish" subtitle="Preview eligibility and publish promotions.">
        {yearLoading ? (
          <Loader label="Loading academic years..." />
        ) : academicYears.length === 0 ? (
          <EmptyState
            title="No academic years"
            description="Create academic years to start promotions."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                label="From Academic Year"
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                <option value="">Select year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                  </option>
                ))}
              </Select>
              <Select
                label="To Academic Year"
                value={toAcademicYearId}
                onChange={(e) => setToAcademicYearId(e.target.value)}
              >
                <option value="">Select year</option>
                {academicYears
                  .filter((year) => year.id !== academicYearId)
                  .map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label}
                    </option>
                  ))}
              </Select>
              <Select
                label="Promotion Type"
                value={promoteBy}
                onChange={(e) => setPromoteBy(e.target.value as "RANK" | "PERCENTAGE")}
              >
                <option value="RANK">Rank</option>
                <option value="PERCENTAGE">Percentage</option>
              </Select>
            </div>
            <Select
              label="Final Exam"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
            >
              <option value="">Select final exam</option>
              {finalExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </Select>

            {sameYearSelected && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700">
                Source and target academic year cannot be the same.
              </div>
            )}
            {!examId && (
              <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4 text-sm text-ink-600">
                Select a final exam to generate promotion preview.
              </div>
            )}
            {fromLocked && (
              <div className="rounded-2xl border border-sunrise-200 bg-sunrise-50/60 p-4 text-sm text-sunrise-700">
                Promotions already published for this academic year.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Total Students" value={summary.total} color="ink" />
              <StatCard label="Eligible" value={summary.eligible} color="jade" />
              <StatCard label="Failed" value={summary.failed} color="sunrise" />
            </div>

            {previewLoading ? (
              <Loader label="Loading preview..." />
            ) : previewError ? (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{previewError}</div>
            ) : previewRecords.length === 0 ? (
              <EmptyState
                title="No students match promotion criteria"
                description="Adjust criteria or academic years to see eligible students."
              />
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={handleGeneratePreview}
                disabled={
                  previewLoading ||
                  !academicYearId ||
                  !toAcademicYearId ||
                  sameYearSelected ||
                  fromLocked ||
                  !examId
                }
              >
                Generate Preview
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canPublish}
                loading={publishing}
              >
                Publish Promotion
              </Button>
              <Button
                variant="secondary"
                onClick={() => setApplyConfirmOpen(true)}
                disabled={!canApplyFinal}
                loading={applyingFinal}
              >
                Apply Final Promotion
              </Button>
              {fromLocked && (
                <Button
                  variant="secondary"
                  onClick={handleAssignRollNumbers}
                  disabled={
                    assigningRolls ||
                    !toAcademicYearId ||
                    !rollStatus?.hasStudents ||
                    !rollStatus?.hasPending
                  }
                  loading={assigningRolls}
                >
                  Assign Roll Numbers
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="Exam Coverage" subtitle="Check if an exam exists for each class.">
        {examCoverageLoading ? (
          <Loader label="Loading class exam coverage..." />
        ) : examCoverageError ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{examCoverageError}</div>
        ) : examCoverage.length === 0 ? (
          <EmptyState title="No classes found" description="Create classes for the selected academic year." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-widest text-ink-400">
                  <th className="px-3">Class</th>
                  <th className="px-3">Exam Count</th>
                  <th className="px-3">Final Exam</th>
                </tr>
              </thead>
              <tbody>
                {examCoverage.map((row) => {
                  const classLabel = /^\d+$/.test(row.className)
                    ? `Class ${row.className}`
                    : row.className;
                  return (
                    <tr key={row.classId} className="rounded-2xl bg-white shadow-sm">
                      <td className="px-3 py-3 font-semibold text-ink-800">{classLabel}</td>
                      <td className="px-3 py-3 text-ink-700">{row.examCount}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {row.hasFinal ? "Yes" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmationModal
        open={confirmOpen}
        title="Confirm Promotion"
        message={`This will evaluate eligibility and create promotion records. Total: ${summary.total}, Eligible: ${summary.eligible}, Failed: ${summary.failed}.`}
        confirmText="Publish Eligibility"
        cancelText="Cancel"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handlePublish}
        loading={publishing}
      />

      <ConfirmationModal
        open={applyConfirmOpen}
        title="Apply Final Promotion"
        message={`This will finalize promotion and update student classes. Total: ${summary.total}, Eligible: ${summary.eligible}, Failed: ${summary.failed}.`}
        confirmText="Apply Final Promotion"
        cancelText="Cancel"
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={handleApplyFinal}
        loading={applyingFinal}
      />
    </div>
  );
}
