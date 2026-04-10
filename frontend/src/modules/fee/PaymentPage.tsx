import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import StatusBadge from "../../components/StatusBadge";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import { useSchoolBranding } from "../../hooks/useSchoolBranding";
import { getStudentFeeStatus, payFee } from "../../services/api/fee";
import { createPaymentOrder, getRazorpayKey, verifyPayment } from "../../services/api/payments";
import { toastUtils } from "../../utils/toast";

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

type PaymentReceipt = {
  payment: {
    id: string;
    amount: number;
    status: string;
    transactionId: string;
    createdAt: string;
  };
  fee: {
    totalAmount: number;
    paidAmount: number;
    status: string;
  };
};

export default function PaymentPage() {
  const { branding } = useSchoolBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { activeStudent, parentStudents, loading: studentLoading } = useActiveStudent();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [amount, setAmount] = useState("" as string);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const stateStudentId = (location.state as { studentId?: string } | null)?.studentId;
    if (stateStudentId) {
      setSelectedStudentId(stateStudentId);
      return;
    }
    if (activeStudent?.id) setSelectedStudentId(activeStudent.id);
  }, [activeStudent?.id, location.state]);

  const feeQuery = useQuery({
    queryKey: ["fee-status", selectedStudentId],
    queryFn: () => getStudentFeeStatus(selectedStudentId as string),
    enabled: Boolean(selectedStudentId),
  });

  const razorpayKeyQuery = useQuery({
    queryKey: ["razorpay-key"],
    queryFn: getRazorpayKey,
  });

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return activeStudent ?? null;
    return parentStudents.find((student) => student.id === selectedStudentId) ?? activeStudent ?? null;
  }, [activeStudent, parentStudents, selectedStudentId]);

  const status = feeQuery.data?.status ?? "NOT_PUBLISHED";
  const baseAmount = feeQuery.data?.baseAmount ?? null;
  const scholarshipAmount = feeQuery.data?.scholarshipAmount ?? null;
  const discountAmount = feeQuery.data?.discountAmount ?? null;
  const lateFee = feeQuery.data?.lateFee ?? null;
  const total = feeQuery.data?.finalAmount ?? feeQuery.data?.totalAmount ?? null;
  const paid = feeQuery.data?.paidAmount ?? null;
  const dueDate = formatDate(feeQuery.data?.dueDate ?? null);
  const remaining =
    total === null || paid === null ? null : Math.max(total - paid, 0);
  const canPay = remaining !== null && remaining > 0 && status !== "NOT_PUBLISHED";

  const loadRazorpayScript = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayment = async () => {
    if (isPaying) return;
    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toastUtils.error("Enter a valid amount");
      return;
    }
    if (!selectedStudentId) {
      toastUtils.error("Select a student");
      return;
    }
    const razorpayKey = razorpayKeyQuery.data?.keyId ?? null;
    if (!razorpayKey) {
      toastUtils.error("Razorpay key is not configured");
      return;
    }

    setIsPaying(true);
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setIsPaying(false);
      toastUtils.error("Unable to load Razorpay");
      return;
    }

    try {
      const order = await createPaymentOrder({
        amount: paymentAmount,
        currency: "INR",
        studentId: selectedStudentId,
        metadata: {
          purpose: "fee",
        },
      });

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency ?? "INR",
        order_id: order.id,
        name: branding.schoolName || "School Fees",
        description: "Fee payment",
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              studentId: selectedStudentId,
              amount: paymentAmount,
            });

            const data = (await payFee({
              studentId: selectedStudentId ?? undefined,
              amount: paymentAmount,
              payment: {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
            })) as PaymentReceipt;

            queryClient.invalidateQueries({ queryKey: ["fee-status", selectedStudentId] });
            toastUtils.success("Payment completed");
            if (data?.payment?.id) {
              sessionStorage.setItem(
                `receipt:${data.payment.id}`,
                JSON.stringify({
                  payment: data.payment,
                  fee: data.fee,
                  student: selectedStudent,
                })
              );
              navigate(`/fees/receipt/${data.payment.id}`, { state: { receipt: data } });
            }
          } catch (err: any) {
            toastUtils.error(err?.message ?? "Payment verification failed");
          } finally {
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
      };

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) {
        toastUtils.error("Payment gateway is unavailable");
        setIsPaying(false);
        return;
      }
      const razorpay = new RazorpayCtor(options);
      razorpay.on("payment.failed", async (resp: any) => {
        const errorDescription = resp?.error?.description ?? "Payment failed";
        toastUtils.error(errorDescription);
        try {
          const orderId = resp?.error?.metadata?.order_id ?? order.id;
          const paymentId = resp?.error?.metadata?.payment_id ?? "failed";
          await verifyPayment({
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: "failed",
            studentId: selectedStudentId,
            amount: paymentAmount,
            errorMessage: errorDescription,
          });
        } catch {
          // ignore logging failures
        } finally {
          setIsPaying(false);
        }
      });
      razorpay.open();
    } catch (err: any) {
      toastUtils.error(err?.message ?? "Unable to start payment");
      setIsPaying(false);
    }
  };

  const statusVariant = useMemo(() => {
    if (status === "PAID") return "success";
    if (status === "PARTIAL") return "warning";
    if (status === "NOT_PUBLISHED") return "neutral";
    return "danger";
  }, [status]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Pay Fees"
        subtitle="Secure payment flow with instant receipts and eligibility updates."
        actions={
          <Button variant="secondary" onClick={() => navigate("/fees")}>Back to Fees</Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Payment" subtitle="Enter the amount you want to pay">
          {studentLoading || feeQuery.isLoading ? (
            <LoadingState label="Loading fee details" />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                  Fee Status
                </div>
                <StatusBadge variant={statusVariant}>{status}</StatusBadge>
                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">Remaining: {formatCurrency(remaining)}</div>
                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">Fee Due Date: {dueDate}</div>
              </div>

              {status === "NOT_PUBLISHED" && (
                <p className="text-sm text-rose-500">Fee not available yet.</p>
              )}

              <Input
                label="Amount to Pay"
                type="number"
                min={1}
                value={amount}
                disabled={!canPay}
                onChange={(e) => setAmount(e.target.value)}
                helper="Partial payments are allowed."
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button loading={isPaying} onClick={handlePayment} disabled={!canPay || isPaying}>
                  Pay Now
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAmount(remaining ? String(remaining) : "")}
                  disabled={!canPay || isPaying}
                >
                  Pay Remaining
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Breakdown" subtitle="Current fee composition">
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Base Fee</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(baseAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Scholarship</span>
              <span className="font-semibold text-emerald-600">-{formatCurrency(scholarshipAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <span className="font-semibold text-emerald-600">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Late Fee</span>
              <span className="font-semibold text-rose-500">{formatCurrency(lateFee)}</span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex items-center justify-between text-base font-semibold text-slate-900 dark:text-slate-100">
              <span>Payable Now</span>
              <span>{formatCurrency(remaining)}</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Final amount reflects applied scholarships, discounts, and late fees.
            </p>
          </div>
        </Card>
      </div>

      {parentStudents.length > 1 && (
        <Card title="Choose Student" subtitle="Pay on behalf of your child">
          <div className="grid gap-4 sm:grid-cols-2">
            {parentStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${selectedStudentId === student.id
                  ? "border-blue-400 bg-blue-50/60 shadow-md dark:bg-blue-500/10"
                  : "border-slate-100 bg-white/80 hover:border-blue-200 dark:bg-slate-900/60 dark:border-slate-800"}`}
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{student.fullName ?? "Student"}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{student.registrationNumber ?? ""}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
