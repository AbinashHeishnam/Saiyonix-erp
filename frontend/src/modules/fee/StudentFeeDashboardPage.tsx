import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import StatusBadge from "../../components/StatusBadge";
import Select from "../../components/Select";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import { getStudentFeeStatus, listReceipts } from "../../services/api/fee";
import { listExamRegistrations } from "../../services/api/exams";

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN");
}

export default function StudentFeeDashboardPage() {
  const navigate = useNavigate();
  const { activeStudent, parentStudents, loading: studentLoading, error } = useActiveStudent();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudent?.id) {
      setSelectedStudentId(activeStudent.id);
    }
  }, [activeStudent?.id]);

  const feeQuery = useQuery({
    queryKey: ["fee-status", selectedStudentId],
    queryFn: () => getStudentFeeStatus(selectedStudentId as string),
    enabled: Boolean(selectedStudentId),
  });

  const registrationsQuery = useQuery({
    queryKey: ["exam-registrations", selectedStudentId],
    queryFn: () => listExamRegistrations(selectedStudentId ?? undefined),
    enabled: Boolean(selectedStudentId),
  });

  const receiptsQuery = useQuery({
    queryKey: ["fee-receipts", selectedStudentId],
    queryFn: () => listReceipts({ studentId: selectedStudentId ?? undefined }),
    enabled: Boolean(selectedStudentId),
  });

  const status = feeQuery.data?.status ?? "NOT_PUBLISHED";
  const baseAmount = feeQuery.data?.baseAmount ?? null;
  const scholarshipAmount = feeQuery.data?.scholarshipAmount ?? null;
  const discountAmount = feeQuery.data?.discountAmount ?? null;
  const lateFee = feeQuery.data?.lateFee ?? null;
  const finalAmount = feeQuery.data?.finalAmount ?? feeQuery.data?.totalAmount ?? null;
  const paid = feeQuery.data?.paidAmount ?? null;
  const dueDate = formatDate(feeQuery.data?.dueDate ?? null);
  const remaining =
    finalAmount === null || paid === null ? null : Math.max(finalAmount - paid, 0);
  const isNotPublished = status === "NOT_PUBLISHED";

  const statusVariant = useMemo(() => {
    if (status === "PAID") return "success";
    if (status === "PARTIAL") return "warning";
    if (status === "NOT_PUBLISHED") return "neutral";
    return "danger";
  }, [status]);

  const registrations = registrationsQuery.data ?? [];
  const registrationCount = registrations.length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Fees & Exam Access"
        subtitle="Track your payments, eligibility, and quick actions for exams."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/exam/registration")}
              disabled={status !== "PAID"}
            >
              Register for Exam
            </Button>
            <Button
              onClick={() => navigate("/fees/pay", { state: { studentId: selectedStudentId } })}
              disabled={isNotPublished}
            >
              Pay Now
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Fee Summary" subtitle="Your fee status for the current term">
          {studentLoading || feeQuery.isLoading ? (
            <LoadingState label="Fetching fee status" />
          ) : error ? (
            <p className="text-sm text-rose-600">Unable to load student details.</p>
          ) : feeQuery.isError ? (
            <p className="text-sm text-rose-600">Unable to load fee status.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { label: "Base Fee", value: formatCurrency(baseAmount) },
                { label: "Scholarship", value: formatCurrency(scholarshipAmount) },
                { label: "Discount", value: formatCurrency(discountAmount) },
                { label: "Late Fee", value: formatCurrency(lateFee) },
                { label: "Payable", value: formatCurrency(finalAmount) },
                { label: "Paid", value: formatCurrency(paid) },
                { label: "Remaining", value: formatCurrency(remaining) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-white/70 p-5 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Status" subtitle="Eligibility snapshot">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Fee Status</span>
              <StatusBadge variant={statusVariant} dot>{status}</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Exam Registration</span>
              <StatusBadge variant={registrationCount > 0 ? "success" : "neutral"} dot>
                {registrationCount > 0 ? "Registered" : "Not Registered"}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Fee Due Date</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dueDate}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              {status === "NOT_PUBLISHED"
                ? "Fee not available yet."
                : status === "PAID"
                  ? "You can register for exams and download admit cards when published."
                  : "Complete payment to unlock exam registration and admit cards."}
            </div>
            {registrationCount > 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
                Registered for {registrationCount} exam{registrationCount > 1 ? "s" : ""}.
              </div>
            )}
            <Button
              variant={status === "PAID" ? "secondary" : "primary"}
              onClick={() => navigate("/fees/pay", { state: { studentId: selectedStudentId } })}
              disabled={isNotPublished}
            >
              {status === "PAID" ? "Pay Again" : "Pay Now"}
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Receipts" subtitle="All fee payment receipts">
        {receiptsQuery.isLoading ? (
          <LoadingState label="Loading receipts" />
        ) : receiptsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load receipts.</p>
        ) : receiptsQuery.data && receiptsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Receipt</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {receiptsQuery.data.map((entry: any) => (
                  <tr key={entry.payment.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">
                      {entry.receipt?.number ?? entry.payment.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 pr-4">
                      {formatCurrency(Number(entry.payment.amount))}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge variant={entry.payment.status === "PAID" ? "success" : "warning"}>
                        {entry.payment.status}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      {entry.payment.createdAt
                        ? new Date(entry.payment.createdAt).toLocaleString("en-IN")
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(`/fees/receipt/${entry.payment.id}`, {
                            state: {
                              receipt: {
                                payment: entry.payment,
                                fee: {
                                  totalAmount: feeQuery.data?.totalAmount ?? 0,
                                  paidAmount: feeQuery.data?.paidAmount ?? 0,
                                  status: feeQuery.data?.status ?? "PENDING",
                                },
                                student: entry.student ?? activeStudent ?? null,
                              },
                              studentId: selectedStudentId ?? undefined,
                            },
                          })
                        }
                      >
                        View Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No receipts yet.</p>
        )}
      </Card>

      <Card title="Student" subtitle="Linked account">
        {studentLoading ? (
          <LoadingState label="Resolving student" />
        ) : parentStudents.length > 1 ? (
          <div className="max-w-md">
            <Select
              label="Select Student"
              value={selectedStudentId ?? ""}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {parentStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName ?? "Student"} {student.registrationNumber ? `• ${student.registrationNumber}` : ""}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Student Name</span>
              <span className="font-semibold">{activeStudent?.fullName ?? "Student"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Registration</span>
              <span className="font-semibold">{activeStudent?.registrationNumber ?? "—"}</span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Exam Registration" subtitle="Eligibility based on fee payment">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Register for exams only after full fee payment is confirmed.</p>
            <Button
              variant="secondary"
              onClick={() => navigate("/exam/registration")}
              disabled={status !== "PAID"}
            >
              {status === "PAID" ? "Register for Exam" : status === "NOT_PUBLISHED" ? "Fee Not Available" : "Payment Required"}
            </Button>
          </div>
        </Card>
        <Card title="Admit Cards" subtitle="Download when published by admin">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Admit cards are available after exam registration and admin publish.</p>
            <Button variant="secondary" onClick={() => navigate("/admit-cards")}>View Admit Cards</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
