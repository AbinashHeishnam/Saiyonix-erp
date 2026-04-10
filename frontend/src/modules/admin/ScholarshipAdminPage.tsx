import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Modal from "../../components/Modal";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { toastUtils } from "../../utils/toast";
import api, { safeApiCall } from "../../services/api/client";
import { listSections } from "../../services/api/metadata";
import { createManualPayment } from "../../services/api/adminPayments";
import {
  createDiscount,
  createFeeDeadline,
  createScholarship,
  deleteDiscount,
  deleteScholarship,
  listDiscounts,
  listFeeDeadlines,
  listLateRecords,
  listScholarships,
  updateDiscount,
  updateScholarship,
} from "../../services/api/fee";

type ScholarshipAdminView =
  | "all"
  | "scholarships"
  | "discounts"
  | "late-fees"
  | "late-payments"
  | "deadlines";

type ScholarshipAdminPageProps = {
  view?: ScholarshipAdminView;
  title?: string;
  subtitle?: string;
};

export default function ScholarshipAdminPage({
  view = "scholarships",
  title = "Scholarships",
  subtitle = "Create and review scholarship records.",
}: ScholarshipAdminPageProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    academicYearId: "",
    classId: "",
  });
  const [scholarshipForm, setScholarshipForm] = useState({
    title: "",
    discountPercent: "",
    classId: "",
    sectionId: "",
    admissionNumber: "",
  });
  const [editingScholarshipId, setEditingScholarshipId] = useState<string | null>(null);
  const [discountForm, setDiscountForm] = useState({
    studentId: "",
    amount: "",
    isPercent: false,
    classId: "",
    sectionId: "",
  });
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [deadlineForm, setDeadlineForm] = useState({
    dueDate: "",
    lateFeePercent: "",
  });
  const [lateSearch, setLateSearch] = useState("");
  const [lateClassId, setLateClassId] = useState("");
  const [lateSectionId, setLateSectionId] = useState("");
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<any | null>(null);
  const [manualPaymentForm, setManualPaymentForm] = useState({
    amount: "",
    method: "CASH" as "CASH" | "ONLINE",
    transactionId: "",
  });

  const classesQuery = useQuery({
    queryKey: ["classes", filters.academicYearId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (filters.academicYearId) params.academicYearId = filters.academicYearId;
      const res = await api.get("/classes", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections", filters.academicYearId],
    queryFn: async () => {
      const res = await listSections({
        academicYearId: filters.academicYearId || undefined,
      });
      return res?.data ?? res ?? [];
    },
  });

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const res = await api.get("/academic-years", { params: { page: 1, limit: 200 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const scholarshipsQuery = useQuery({
    queryKey: ["scholarships", filters.academicYearId],
    queryFn: () => listScholarships({ academicYearId: filters.academicYearId || undefined }),
  });

  const discountsQuery = useQuery({
    queryKey: ["discounts", filters.academicYearId],
    queryFn: () => listDiscounts({ academicYearId: filters.academicYearId || undefined }),
  });

  const deadlinesQuery = useQuery({
    queryKey: ["fee-deadlines", filters.academicYearId],
    queryFn: () => listFeeDeadlines({ academicYearId: filters.academicYearId || undefined }),
  });

  const lateQuery = useQuery({
    queryKey: ["late-records", filters.academicYearId, filters.classId],
    queryFn: () =>
      listLateRecords({
        academicYearId: filters.academicYearId || undefined,
        classId: filters.classId || undefined,
      }),
  });

  const scholarshipMutation = useMutation({
    mutationFn: async () => {
      if (!scholarshipForm.discountPercent) {
        throw new Error("Discount percent is required");
      }
      return await safeApiCall(
        () =>
          (editingScholarshipId
            ? updateScholarship(editingScholarshipId, {
              title: scholarshipForm.title || undefined,
              discountPercent: Number(scholarshipForm.discountPercent),
              classId: scholarshipForm.classId || undefined,
              sectionId: scholarshipForm.sectionId || undefined,
              admissionNumber: scholarshipForm.admissionNumber || undefined,
              academicYearId: filters.academicYearId || undefined,
            })
            : createScholarship({
              title: scholarshipForm.title || undefined,
              discountPercent: Number(scholarshipForm.discountPercent),
              classId: scholarshipForm.classId || undefined,
              sectionId: scholarshipForm.sectionId || undefined,
              admissionNumber: scholarshipForm.admissionNumber || undefined,
              academicYearId: filters.academicYearId || undefined,
            })),
        {
          loading: editingScholarshipId ? "Updating scholarship..." : "Saving scholarship...",
          success: editingScholarshipId ? "Scholarship updated" : "Scholarship saved",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scholarships"] });
      setEditingScholarshipId(null);
      setScholarshipForm({
        title: "",
        discountPercent: "",
        classId: "",
        sectionId: "",
        admissionNumber: "",
      });
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save scholarship"),
  });

  const discountMutation = useMutation({
    mutationFn: async () => {
      if (!discountForm.studentId && !discountForm.classId && !discountForm.sectionId) {
        throw new Error("Select a student, class, or section");
      }
      return await safeApiCall(
        () =>
          (editingDiscountId
            ? updateDiscount(editingDiscountId, {
              studentId: discountForm.studentId.trim() || undefined,
              classId: discountForm.classId || undefined,
              sectionId: discountForm.sectionId || undefined,
              amount: Number(discountForm.amount),
              isPercent: discountForm.isPercent,
              academicYearId: filters.academicYearId || undefined,
            })
            : createDiscount({
              studentId: discountForm.studentId.trim() || undefined,
              classId: discountForm.classId || undefined,
              sectionId: discountForm.sectionId || undefined,
              amount: Number(discountForm.amount),
              isPercent: discountForm.isPercent,
              academicYearId: filters.academicYearId || undefined,
            })),
        {
          loading: editingDiscountId ? "Updating discount..." : "Saving discount...",
          success: editingDiscountId ? "Discount updated" : "Discount saved",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setEditingDiscountId(null);
      setDiscountForm({
        studentId: "",
        amount: "",
        isPercent: false,
        classId: "",
        sectionId: "",
      });
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save discount"),
  });

  const deadlineMutation = useMutation({
    mutationFn: async () => {
      return await safeApiCall(
        () =>
          createFeeDeadline({
            dueDate: deadlineForm.dueDate,
            lateFeePercent: Number(deadlineForm.lateFeePercent),
            classId: filters.classId || undefined,
            academicYearId: filters.academicYearId || undefined,
          }),
        { loading: "Saving late fee...", success: "Late fee updated" }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fee-deadlines"] }),
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save deadline"),
  });

  const manualPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!manualTarget?.studentId || !manualTarget?.feeTermId) {
        throw new Error("Student and fee term are required");
      }
      if (!manualPaymentForm.amount) {
        throw new Error("Amount is required");
      }
      if (manualPaymentForm.method === "ONLINE" && !manualPaymentForm.transactionId) {
        throw new Error("Transaction ID is required for online payments");
      }
      return await safeApiCall(
        () =>
          createManualPayment({
            studentId: manualTarget.studentId,
            feeTermId: manualTarget.feeTermId,
            amount: Number(manualPaymentForm.amount),
            method: manualPaymentForm.method,
            transactionId: manualPaymentForm.transactionId || undefined,
          }),
        { loading: "Recording payment...", success: "Payment marked as paid" }
      );
    },
    onSuccess: () => {
      setManualPaymentOpen(false);
      setManualPaymentForm({ amount: "", method: "CASH", transactionId: "" });
      queryClient.invalidateQueries({ queryKey: ["late-records"] });
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? err?.message ?? "Unable to record payment"),
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const scholarshipSections = useMemo(() => {
    if (!scholarshipForm.classId) return sections;
    return sections.filter((section: any) => section.classId === scholarshipForm.classId);
  }, [sections, scholarshipForm.classId]);
  const discountSections = useMemo(() => {
    if (!discountForm.classId) return sections;
    return sections.filter((section: any) => section.classId === discountForm.classId);
  }, [sections, discountForm.classId]);
  const filteredLateSections = useMemo(() => {
    if (!lateClassId) return sections;
    return sections.filter((section: any) => section.classId === lateClassId);
  }, [sections, lateClassId]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, classId: "" }));
    setScholarshipForm((prev) => ({ ...prev, classId: "", sectionId: "" }));
    setDiscountForm((prev) => ({ ...prev, classId: "", sectionId: "" }));
    setLateClassId("");
    setLateSectionId("");
  }, [filters.academicYearId]);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  const filteredLateRecords = useMemo(() => {
    const records = lateQuery.data ?? [];
    const search = lateSearch.trim().toLowerCase();
    return records.filter((item: any) => {
      if (lateClassId && item.classId !== lateClassId) return false;
      if (lateSectionId && item.sectionId !== lateSectionId) return false;
      if (!search) return true;
      const haystack = [
        item.studentName,
        item.registrationNumber,
        item.admissionNumber,
        item.rollNumber ? String(item.rollNumber) : "Pending",
        item.className,
        item.sectionName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [lateQuery.data, lateSearch, lateClassId, lateSectionId]);

  const lateSummary = useMemo(() => {
    const records = filteredLateRecords ?? [];
    const paidCount = records.filter((r: any) => r.status === "PAID").length;
    const partialCount = records.filter((r: any) => r.status === "PARTIAL").length;
    const pendingCount = records.filter((r: any) => r.status !== "PAID" && r.status !== "PARTIAL").length;
    const totalPaid = records.reduce((sum: number, r: any) => sum + Number(r.paidAmount ?? 0), 0);
    const totalPending = records.reduce(
      (sum: number, r: any) => sum + Math.max(Number(r.totalAmount ?? 0) - Number(r.paidAmount ?? 0), 0),
      0
    );
    return {
      totalCount: records.length,
      paidCount,
      partialCount,
      pendingCount,
      totalPaid,
      totalPending,
    };
  }, [filteredLateRecords]);

  const showScholarships = view === "all" || view === "scholarships";
  const showDiscounts = view === "all" || view === "discounts";
  const showLateFees = view === "all" || view === "late-fees";
  const showLatePayments = view === "all" || view === "late-payments";
  const showDeadlines = view === "all" || view === "deadlines" || view === "late-fees";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title={title} subtitle={subtitle} />

      <Card title="Filters" subtitle="Scope records by academic year or class">
        <div className="grid gap-4 md:grid-cols-2">
          <AcademicYearFilter
            value={filters.academicYearId}
            onChange={(value) => setFilters((prev) => ({ ...prev, academicYearId: value }))}
            includeAllOption
            allLabel="All Years"
            syncQueryKey="academicYearId"
            years={years}
          />
          <Select
            label="Class"
            value={filters.classId}
            onChange={(e) => setFilters((prev) => ({ ...prev, classId: e.target.value }))}
          >
            <option value="">All Classes</option>
            {classes.map((cls: any) => (
              <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {showScholarships && (
          <Card title="Scholarship" subtitle="Apply scholarship to class, section, or student">
            <div className="flex flex-col gap-4">
              <Input
                label="Title (optional)"
                value={scholarshipForm.title}
                onChange={(e) => setScholarshipForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <Input
                label="Discount Percent"
                type="number"
                value={scholarshipForm.discountPercent}
                onChange={(e) => setScholarshipForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
              />
              <Select
                label="Class (optional)"
                value={scholarshipForm.classId}
                onChange={(e) =>
                  setScholarshipForm((prev) => ({
                    ...prev,
                    classId: e.target.value,
                    sectionId: "",
                  }))
                }
              >
                <option value="">All Classes</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
                ))}
              </Select>
              <Select
                label="Section (optional)"
                value={scholarshipForm.sectionId}
                onChange={(e) => setScholarshipForm((prev) => ({ ...prev, sectionId: e.target.value }))}
                disabled={!scholarshipForm.classId}
              >
                <option value="">All Sections</option>
                {scholarshipSections.map((section: any) => (
                  <option key={section.id} value={section.id}>{section.sectionName ?? "Section"}</option>
                ))}
              </Select>
              <Input
                label="Admission Number (optional)"
                value={scholarshipForm.admissionNumber}
                onChange={(e) => setScholarshipForm((prev) => ({ ...prev, admissionNumber: e.target.value }))}
              />
              <Button variant="secondary" loading={scholarshipMutation.isPending} onClick={() => scholarshipMutation.mutate()}>
                {editingScholarshipId ? "Update Scholarship" : "Save Scholarship"}
              </Button>
              {editingScholarshipId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingScholarshipId(null);
                    setScholarshipForm({
                      title: "",
                      discountPercent: "",
                      classId: "",
                      sectionId: "",
                      admissionNumber: "",
                    });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </Card>
        )}

        {showDiscounts && (
          <Card title="Discount" subtitle="Apply discount to student">
            <div className="flex flex-col gap-4">
              <Input
                label="Student ID (optional)"
                value={discountForm.studentId}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, studentId: e.target.value }))}
              />
              <Select
                label="Class (optional)"
                value={discountForm.classId}
                onChange={(e) =>
                  setDiscountForm((prev) => ({
                    ...prev,
                    classId: e.target.value,
                    sectionId: "",
                  }))
                }
              >
                <option value="">All Classes</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
                ))}
              </Select>
              <Select
                label="Section (optional)"
                value={discountForm.sectionId}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, sectionId: e.target.value }))}
                disabled={!discountForm.classId}
              >
                <option value="">All Sections</option>
                {discountSections.map((section: any) => (
                  <option key={section.id} value={section.id}>{section.sectionName ?? "Section"}</option>
                ))}
              </Select>
              <Input
                label="Amount"
                type="number"
                value={discountForm.amount}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <input
                  id="discount-percent"
                  type="checkbox"
                  checked={discountForm.isPercent}
                  onChange={(e) => setDiscountForm((prev) => ({ ...prev, isPercent: e.target.checked }))}
                />
                <label htmlFor="discount-percent">Percent based</label>
              </div>
              <Button variant="secondary" loading={discountMutation.isPending} onClick={() => discountMutation.mutate()}>
                {editingDiscountId ? "Update Discount" : "Save Discount"}
              </Button>
              {editingDiscountId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingDiscountId(null);
                    setDiscountForm({
                      studentId: "",
                      amount: "",
                      isPercent: false,
                      classId: "",
                      sectionId: "",
                    });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </Card>
        )}

        {showLateFees && (
          <Card title="Late Fee" subtitle="Set late fee penalty">
            <div className="flex flex-col gap-4">
              <Input
                label="Due Date"
                type="date"
                value={deadlineForm.dueDate}
                onChange={(e) => setDeadlineForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
              <Input
                label="Late Fee (%)"
                type="number"
                value={deadlineForm.lateFeePercent}
                onChange={(e) => setDeadlineForm((prev) => ({ ...prev, lateFeePercent: e.target.value }))}
              />
              <Button variant="secondary" loading={deadlineMutation.isPending} onClick={() => deadlineMutation.mutate()}>
                Save Late Fee
              </Button>
            </div>
          </Card>
        )}
      </div>

      {showScholarships && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Scholarship Records" subtitle="Recent scholarships">
          {scholarshipsQuery.isLoading ? (
            <LoadingState label="Loading scholarships" />
          ) : scholarshipsQuery.isError ? (
            <p className="text-sm text-rose-600">Unable to load scholarships.</p>
          ) : scholarshipsQuery.data && scholarshipsQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Discount %</th>
                  <th className="py-2 pr-4">Admission</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Section</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {scholarshipsQuery.data.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">
                      {item.admissionNumber
                        ? item.studentName ?? item.admissionNumber
                        : item.sectionName
                          ? "Section"
                          : item.className
                            ? "Class"
                            : "—"}
                    </td>
                    <td className="py-3 pr-4">{item.discountPercent ?? "—"}</td>
                    <td className="py-3 pr-4">{item.admissionNumber ?? "—"}</td>
                    <td className="py-3 pr-4">{item.className ?? "—"}</td>
                    <td className="py-3 pr-4">{item.sectionName ?? "—"}</td>
                    <td className="py-3 pr-4">{new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingScholarshipId(item.id);
                            setScholarshipForm({
                              title: item.title ?? "",
                              discountPercent: item.discountPercent ? String(item.discountPercent) : "",
                              classId: item.classId ?? "",
                              sectionId: item.sectionId ?? "",
                              admissionNumber: item.admissionNumber ?? "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm("Delete this scholarship?")) return;
                            try {
                              await deleteScholarship(item.id);
                              toastUtils.success("Scholarship deleted");
                              queryClient.invalidateQueries({ queryKey: ["scholarships"] });
                            } catch (err: any) {
                              toastUtils.error(err?.response?.data?.message ?? "Unable to delete scholarship");
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No scholarship records found.</p>
          )}
        </Card>
        </div>
      )}

      {showLatePayments && (
        <Card title="Fee Payment Summary" subtitle="Paid, partial, and pending overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Students", value: lateSummary.totalCount },
              { label: "Paid", value: lateSummary.paidCount },
              { label: "Partial", value: lateSummary.partialCount },
              { label: "Pending", value: lateSummary.pendingCount },
              { label: "Total Paid", value: `₹${lateSummary.totalPaid.toFixed(2)}` },
              { label: "Total Pending", value: `₹${lateSummary.totalPending.toFixed(2)}` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="mt-2 text-xl font-extrabold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showLatePayments && (
        <Card title="Late Payments" subtitle="Who is late and who is not">
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Input
            label="Search"
            value={lateSearch}
            onChange={(e) => setLateSearch(e.target.value)}
            placeholder="Name / Admission / Roll / Reg No."
          />
          <Select
            label="Class"
            value={lateClassId}
            onChange={(e) => {
              setLateClassId(e.target.value);
              setLateSectionId("");
            }}
          >
            <option value="">All Classes</option>
            {classes.map((cls: any) => (
              <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
            ))}
          </Select>
          <Select
            label="Section"
            value={lateSectionId}
            onChange={(e) => setLateSectionId(e.target.value)}
            disabled={!lateClassId}
          >
            <option value="">All Sections</option>
            {filteredLateSections.map((section: any) => (
              <option key={section.id} value={section.id}>{section.sectionName ?? "Section"}</option>
            ))}
          </Select>
        </div>
        {lateQuery.isLoading ? (
          <LoadingState label="Loading fee records" />
        ) : lateQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load fee records.</p>
        ) : filteredLateRecords && filteredLateRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Admission</th>
                  <th className="py-2 pr-4">Roll</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Section</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Late</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                  {filteredLateRecords.map((item: any) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-semibold">{item.studentName ?? item.studentId}</td>
                      <td className="py-3 pr-4">{item.admissionNumber ?? "—"}</td>
                      <td className="py-3 pr-4">{item.rollNumber ?? "Pending"}</td>
                      <td className="py-3 pr-4">{item.className ?? "—"}</td>
                      <td className="py-3 pr-4">{item.sectionName ?? "—"}</td>
                      <td className="py-3 pr-4">{item.status}</td>
                      <td className="py-3 pr-4">{item.isLate ? "LATE" : "ON TIME"}</td>
                      <td className="py-3 pr-4">
                        {item.status !== "PAID" ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const remaining = Math.max(
                                Number(item.totalAmount ?? 0) - Number(item.paidAmount ?? 0),
                                0
                              );
                              setManualTarget(item);
                              setManualPaymentForm((prev) => ({
                                ...prev,
                                amount: remaining ? String(remaining) : "",
                              }));
                              setManualPaymentOpen(true);
                            }}
                            disabled={!item.feeTermId}
                          >
                            Mark as Paid
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        ) : (
          <p className="text-sm text-slate-500">No fee records found.</p>
        )}
      </Card>
      )}

      {showDiscounts && (
        <Card title="Discount Records" subtitle="Discounts applied">
        {discountsQuery.isLoading ? (
          <LoadingState label="Loading discounts" />
        ) : discountsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load discounts.</p>
        ) : discountsQuery.data && discountsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Reg No.</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Section</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Percent</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {discountsQuery.data.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{item.studentName ?? "All Students"}</td>
                    <td className="py-3 pr-4">{item.registrationNumber ?? "—"}</td>
                    <td className="py-3 pr-4">{item.className ?? "—"}</td>
                    <td className="py-3 pr-4">{item.sectionName ?? "—"}</td>
                    <td className="py-3 pr-4">₹{Number(item.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4">{item.isPercent ? "YES" : "NO"}</td>
                    <td className="py-3 pr-4">{new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingDiscountId(item.id);
                            setDiscountForm({
                              studentId: item.studentId ?? "",
                              amount: item.amount ? String(item.amount) : "",
                              isPercent: Boolean(item.isPercent),
                              classId: item.classId ?? "",
                              sectionId: item.sectionId ?? "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm("Delete this discount?")) return;
                            try {
                              await deleteDiscount(item.id);
                              toastUtils.success("Discount deleted");
                              queryClient.invalidateQueries({ queryKey: ["discounts"] });
                            } catch (err: any) {
                              toastUtils.error(err?.response?.data?.message ?? "Unable to delete discount");
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No discount records found.</p>
        )}
      </Card>
      )}

      {showDeadlines && (
        <Card
          title={view === "late-fees" ? "Late Fee Saved Details" : "Late Fee Deadlines"}
          subtitle={view === "late-fees" ? "Saved late fee records" : "Fee deadlines and penalties"}
        >
        {deadlinesQuery.isLoading ? (
          <LoadingState label="Loading fee deadlines" />
        ) : deadlinesQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load deadlines.</p>
        ) : deadlinesQuery.data && deadlinesQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Due Date</th>
                  <th className="py-2 pr-4">Late Fee %</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {deadlinesQuery.data.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{item.className ?? "All Classes"}</td>
                    <td className="py-3 pr-4">{new Date(item.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 pr-4">{item.lateFeePercent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No fee deadlines found.</p>
        )}
      </Card>
      )}

      <Modal
        open={manualPaymentOpen}
        onClose={() => setManualPaymentOpen(false)}
        title="Mark Fee as Paid"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Recording manual payment for {manualTarget?.studentName ?? manualTarget?.studentId ?? "student"}.
          </p>
          <Input
            label="Amount"
            type="number"
            value={manualPaymentForm.amount}
            onChange={(e) => setManualPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <Select
            label="Method"
            value={manualPaymentForm.method}
            onChange={(e) =>
              setManualPaymentForm((prev) => ({ ...prev, method: e.target.value as "CASH" | "ONLINE" }))
            }
          >
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online</option>
          </Select>
          <Input
            label="Transaction ID (Online only)"
            value={manualPaymentForm.transactionId}
            onChange={(e) => setManualPaymentForm((prev) => ({ ...prev, transactionId: e.target.value }))}
            disabled={manualPaymentForm.method !== "ONLINE"}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              loading={manualPaymentMutation.isPending}
              onClick={() => manualPaymentMutation.mutate()}
            >
              Confirm Payment
            </Button>
            <Button variant="secondary" onClick={() => setManualPaymentOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
