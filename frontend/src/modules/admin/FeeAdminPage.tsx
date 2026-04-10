import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import LoadingState from "../../components/LoadingState";
import api, { safeApiCall } from "../../services/api/client";
import { createFeeStructure, createScholarship, listFeeStructures, publishFeeStructure } from "../../services/api/fee";
import { listExams } from "../../services/api/exams";
import { toastUtils } from "../../utils/toast";
import { listSections } from "../../services/api/metadata";
import AcademicYearFilter from "../../components/AcademicYearFilter";

export default function FeeAdminPage() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState("");
  const [feeForm, setFeeForm] = useState({
    classId: "",
    academicYearId: "",
    amount: "",
  });

  const [scholarshipForm, setScholarshipForm] = useState({
    title: "",
    discountPercent: "",
    classId: "",
    sectionId: "",
    admissionNumber: "",
  });

  const [discountForm, setDiscountForm] = useState({
    studentId: "",
    amount: "",
    isPercent: false,
    classId: "",
    sectionId: "",
  });

  const [deadlineForm, setDeadlineForm] = useState({
    dueDate: "",
    lateFeePercent: "",
  });

  const [publishExamId, setPublishExamId] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (academicYearId) params.academicYearId = academicYearId;
      const res = await api.get("/classes", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections", academicYearId],
    queryFn: async () => {
      const res = await listSections({
        academicYearId: academicYearId || undefined,
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

  const examsQuery = useQuery({
    queryKey: ["exams", "list", academicYearId],
    queryFn: () => listExams({ page: 1, limit: 100, academicYearId: academicYearId || undefined }),
  });

  const feeMutation = useMutation({
    mutationFn: async () => {
      if (!feeForm.classId || !feeForm.amount) {
        throw new Error("Class and amount are required");
      }
      return await safeApiCall(() =>
        createFeeStructure({
          classId: feeForm.classId,
          academicYearId: feeForm.academicYearId || undefined,
          amount: Number(feeForm.amount),
        }),
        { loading: "Saving fee structure...", success: "Fee structure saved" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
    },
  });

  const publishFeeMutation = useMutation({
    mutationFn: async () => {
      if (!feeForm.classId) {
        throw new Error("Select a class to publish");
      }
      return await safeApiCall(() =>
        publishFeeStructure({
          classId: feeForm.classId,
          academicYearId: feeForm.academicYearId || undefined,
        }),
        { loading: "Publishing fee structure...", success: "Fee structure published" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
    },
  });

  const feeStructuresQuery = useQuery({
    queryKey: ["fee-structures", feeForm.academicYearId, feeForm.classId],
    queryFn: () =>
      listFeeStructures({
        academicYearId: feeForm.academicYearId || undefined,
        classId: feeForm.classId || undefined,
      }),
  });

  const scholarshipMutation = useMutation({
    mutationFn: async () => {
      if (!scholarshipForm.discountPercent) {
        throw new Error("Discount percent is required");
      }
      return await safeApiCall(() =>
        createScholarship({
          title: scholarshipForm.title || undefined,
          discountPercent: Number(scholarshipForm.discountPercent),
          classId: scholarshipForm.classId || undefined,
          sectionId: scholarshipForm.sectionId || undefined,
          admissionNumber: scholarshipForm.admissionNumber || undefined,
          academicYearId: academicYearId || undefined,
        }),
        { loading: "Saving scholarship...", success: "Scholarship saved" }
      );
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save scholarship"),
  });

  const discountMutation = useMutation({
    mutationFn: async () => {
      if (!discountForm.studentId && !discountForm.classId && !discountForm.sectionId) {
        throw new Error("Select a student, class, or section");
      }
      return await safeApiCall(() =>
        api.post("/discounts", {
          studentId: discountForm.studentId.trim() || undefined,
          classId: discountForm.classId || undefined,
          sectionId: discountForm.sectionId || undefined,
          amount: Number(discountForm.amount),
          isPercent: discountForm.isPercent,
          academicYearId: academicYearId || undefined,
        }),
        { loading: "Saving discount...", success: "Discount saved" }
      );
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save discount"),
  });

  const deadlineMutation = useMutation({
    mutationFn: async () => {
      return await safeApiCall(() =>
        api.post("/fee-deadlines", {
          dueDate: deadlineForm.dueDate,
          lateFeePercent: Number(deadlineForm.lateFeePercent),
          academicYearId: academicYearId || undefined,
        }),
        { loading: "Saving late fee...", success: "Late fee updated" }
      );
    },
    onError: (err: any) => toastUtils.error(err?.response?.data?.message ?? "Unable to save deadline"),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!publishExamId) throw new Error("Select an exam to publish");
      return await safeApiCall(() => api.post("/admin/admit-card/publish", { examId: publishExamId }), {
        loading: "Publishing admit cards...",
        success: "Admit cards published",
      });
    },
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
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  useEffect(() => {
    if (academicYearId && feeForm.academicYearId !== academicYearId) {
      setFeeForm((prev) => ({ ...prev, academicYearId }));
    }
  }, [academicYearId, feeForm.academicYearId]);

  useEffect(() => {
    setFeeForm((prev) => ({ ...prev, classId: "" }));
    setScholarshipForm((prev) => ({ ...prev, classId: "", sectionId: "" }));
    setDiscountForm((prev) => ({ ...prev, classId: "", sectionId: "" }));
    setPublishExamId("");
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Fee Management" subtitle="Configure fees, scholarships, discounts, and publish admit cards." />
      <AcademicYearFilter
        value={academicYearId}
        onChange={setAcademicYearId}
        syncQueryKey="academicYearId"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Fee Structure" subtitle="Define base fee per class">
          {classesQuery.isLoading || yearsQuery.isLoading ? (
            <LoadingState label="Loading classes" />
          ) : (
            <div className="flex flex-col gap-4">
              <Select
                label="Class"
                value={feeForm.classId}
                onChange={(e) => setFeeForm((prev) => ({ ...prev, classId: e.target.value }))}
              >
                <option value="">Select class</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
                ))}
              </Select>
              <Select
                label="Academic Year"
                value={feeForm.academicYearId}
                onChange={(e) => setFeeForm((prev) => ({ ...prev, academicYearId: e.target.value }))}
              >
                <option value="">Active Year</option>
                {years.map((year: any) => (
                  <option key={year.id} value={year.id}>{year.label ?? year.session ?? "Year"}</option>
                ))}
              </Select>
              <Input
                label="Amount"
                type="number"
                value={feeForm.amount}
                onChange={(e) => setFeeForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <div className="flex flex-wrap gap-3">
                <Button loading={feeMutation.isPending} onClick={() => feeMutation.mutate()}>
                  Save Fee Structure
                </Button>
                <Button
                  variant="secondary"
                  loading={publishFeeMutation.isPending}
                  onClick={() => publishFeeMutation.mutate()}
                >
                  Publish Fee Structure
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Issued Fees" subtitle="Published fee structures by class">
          {feeStructuresQuery.isLoading ? (
            <LoadingState label="Loading fee structures" />
          ) : feeStructuresQuery.isError ? (
            <p className="text-sm text-rose-600">Unable to load fee structures.</p>
          ) : feeStructuresQuery.data && feeStructuresQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Class</th>
                    <th className="py-2 pr-4">Academic Year</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {feeStructuresQuery.data.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-semibold">
                        {item.className ?? item.classId}
                      </td>
                      <td className="py-3 pr-4">{item.academicYear ?? "—"}</td>
                      <td className="py-3 pr-4">₹{item.amount.toFixed(2)}</td>
                      <td className="py-3 pr-4">
                        {item.isPublished ? "PUBLISHED" : "DRAFT"}
                      </td>
                      <td className="py-3 pr-4">
                        {new Date(item.updatedAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No fee structures found.</p>
          )}
        </Card>

        <Card title="Admit Card Publish" subtitle="Enable admit cards for registered students">
          {examsQuery.isLoading ? (
            <LoadingState label="Loading exams" />
          ) : (
            <div className="flex flex-col gap-4">
              <Select
                label="Exam"
                value={publishExamId}
                onChange={(e) => setPublishExamId(e.target.value)}
              >
                <option value="">Select exam</option>
                {exams.map((exam: any) => (
                  <option key={exam.id} value={exam.id}>{exam.title ?? "Exam"}</option>
                ))}
              </Select>
              <Button loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                Publish Admit Cards
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
              Save Scholarship
            </Button>
          </div>
        </Card>

        <Card title="Discount" subtitle="Apply discount to student or class">
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
              Save Discount
            </Button>
          </div>
        </Card>

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
      </div>
    </div>
  );
}
