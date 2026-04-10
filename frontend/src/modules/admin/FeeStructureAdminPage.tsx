import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import {
  createFeeDeadline,
  createFeeStructure,
  listFeeDeadlines,
  listFeeStructures,
  publishFeeStructure,
} from "../../services/api/fee";
import api, { safeApiCall } from "../../services/api/client";
import AcademicYearFilter from "../../components/AcademicYearFilter";

export default function FeeStructureAdminPage() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState("");
  const [feeForm, setFeeForm] = useState({
    classId: "",
    academicYearId: "",
    amount: "",
  });
  const [deadlineForm, setDeadlineForm] = useState({
    classId: "",
    dueDate: "",
    lateFeePercent: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (academicYearId) params.academicYearId = academicYearId;
      const res = await api.get("/classes", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const res = await api.get("/academic-years", { params: { page: 1, limit: 200 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const feeMutation = useMutation({
    mutationFn: async () => {
      if (!feeForm.classId || !feeForm.amount) {
        throw new Error("Class and amount are required");
      }
      return await safeApiCall(
        () =>
          createFeeStructure({
            classId: feeForm.classId,
            academicYearId: feeForm.academicYearId || undefined,
            amount: Number(feeForm.amount),
          }),
        {
          loading: editingId ? "Updating fee structure..." : "Saving fee structure...",
          success: editingId ? "Fee structure updated" : "Fee structure saved",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setEditingId(null);
      setFeeForm({ classId: "", academicYearId: "", amount: "" });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fee-structures"] }),
  });

  const feeStructuresQuery = useQuery({
    queryKey: ["fee-structures", feeForm.academicYearId, feeForm.classId],
    queryFn: () =>
      listFeeStructures({
        academicYearId: feeForm.academicYearId || undefined,
        classId: feeForm.classId || undefined,
      }),
  });

  const deadlineMutation = useMutation({
    mutationFn: async () => {
      if (!deadlineForm.dueDate) {
        throw new Error("Due date is required");
      }
      return await safeApiCall(
        () =>
          createFeeDeadline({
            dueDate: deadlineForm.dueDate,
            lateFeePercent: deadlineForm.lateFeePercent
              ? Number(deadlineForm.lateFeePercent)
              : undefined,
            classId: deadlineForm.classId || undefined,
            academicYearId: academicYearId || undefined,
          }),
        { loading: "Saving late fee...", success: "Late fee saved" }
      );
    },
    onSuccess: () => {
      setDeadlineForm({ classId: "", dueDate: "", lateFeePercent: "" });
      queryClient.invalidateQueries({ queryKey: ["fee-deadlines"] });
    },
  });

  const deadlinesQuery = useQuery({
    queryKey: ["fee-deadlines", academicYearId],
    queryFn: () => listFeeDeadlines({ academicYearId: academicYearId || undefined }),
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const isEditing = Boolean(editingId);

  useEffect(() => {
    if (academicYearId && feeForm.academicYearId !== academicYearId) {
      setFeeForm((prev) => ({ ...prev, academicYearId }));
    }
    setFeeForm((prev) => ({ ...prev, classId: "" }));
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Fee Structure" subtitle="Create, publish, and track issued fee structures." />
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
                disabled={isEditing}
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
                disabled={isEditing}
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
                  {isEditing ? "Update Fee Structure" : "Save Fee Structure"}
                </Button>
                {isEditing && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setFeeForm({ classId: "", academicYearId: "", amount: "" });
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
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
                  <th className="py-2 pr-4">Action</th>
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
                      <td className="py-3 pr-4">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(item.id);
                            setFeeForm({
                              classId: item.classId,
                              academicYearId: item.academicYearId,
                              amount: String(item.amount),
                            });
                          }}
                        >
                          Edit
                        </Button>
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
      </div>

      <Card title="Late Fee Deadlines" subtitle="Set and review late fee penalties">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Select
              label="Class (optional)"
              value={deadlineForm.classId}
              onChange={(e) => setDeadlineForm((prev) => ({ ...prev, classId: e.target.value }))}
            >
              <option value="">All Classes</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
              ))}
            </Select>
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
            <Button
              variant="secondary"
              loading={deadlineMutation.isPending}
              onClick={() => deadlineMutation.mutate()}
            >
              Save Late Fee
            </Button>
          </div>

          <div>
            {deadlinesQuery.isLoading ? (
              <LoadingState label="Loading late fee deadlines" />
            ) : deadlinesQuery.isError ? (
              <p className="text-sm text-rose-600">Unable to load late fee deadlines.</p>
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
                        <td className="py-3 pr-4">
                          {new Date(item.dueDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3 pr-4">{item.lateFeePercent ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No late fee deadlines found.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
