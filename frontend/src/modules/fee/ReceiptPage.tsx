import { useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Button from "../../components/Button";
import Card from "../../components/Card";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import { usePrint } from "../../hooks/usePrint";
import { getReceipt } from "../../services/api/fee";

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

type ReceiptPayload = {
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
  student?: {
    id?: string;
    fullName?: string | null;
    registrationNumber?: string | null;
  } | null;
};

export default function ReceiptPage() {
  const navigate = useNavigate();
  const { paymentId } = useParams();
  const location = useLocation();
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const handlePrint = usePrint(printRootRef);

  const receipt = useMemo(() => {
    const stateReceipt = (location.state as { receipt?: ReceiptPayload } | null)?.receipt;
    if (stateReceipt) return stateReceipt;
    if (!paymentId) return null;
    const stored = sessionStorage.getItem(`receipt:${paymentId}`);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as ReceiptPayload;
    } catch {
      return null;
    }
  }, [location.state, paymentId]);

  const receiptQuery = useQuery({
    queryKey: ["fee-receipt", paymentId],
    queryFn: () =>
      getReceipt(paymentId as string, {
        studentId: (location.state as { studentId?: string } | null)?.studentId,
      }),
    enabled: Boolean(paymentId && !receipt),
  });

  const resolvedReceipt = receipt ?? receiptQuery.data ?? null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Receipt"
        subtitle="Payment confirmation and fee update."
        actions={
          <div className="flex gap-3 print-hide">
            <Button variant="secondary" onClick={() => navigate("/fees")}>Back to Fees</Button>
            <Button onClick={handlePrint}>Download PDF</Button>
          </div>
        }
      />

      <div ref={printRootRef} className="print-root print-color print-no-shadow print-no-border-radius">
        <Card title="Receipt" subtitle="Official payment record">
        {receiptQuery.isLoading ? (
          <LoadingState label="Loading receipt" />
        ) : !resolvedReceipt ? (
          <p className="text-sm text-slate-500">Receipt data is not available. Complete a payment to generate one.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Payment ID</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resolvedReceipt.payment.id}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Transaction</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resolvedReceipt.payment.transactionId}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Date</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(resolvedReceipt.payment.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Student</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resolvedReceipt.student?.fullName ?? "Student"}</p>
                <p className="text-xs text-slate-400">{resolvedReceipt.student?.registrationNumber ?? ""}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Amount Paid</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(resolvedReceipt.payment.amount)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Fee Status</span>
                  <span>{resolvedReceipt.fee.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Total Paid</span>
                  <span>{formatCurrency(resolvedReceipt.fee.paidAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  );
}
