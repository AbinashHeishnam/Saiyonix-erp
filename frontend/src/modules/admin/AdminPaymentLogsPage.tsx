import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "../../components/Card";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { downloadPaymentReceipt, getPaymentLogs } from "../../services/api/adminPayments";
import { toastUtils } from "../../utils/toast";

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminPaymentLogsPage() {
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = useMemo(() => {
    const normalizedStatus =
      status === "SUCCESS" || status === "FAILED"
        ? (status as "SUCCESS" | "FAILED")
        : undefined;
    return {
      studentName: studentName.trim() || undefined,
      studentId: studentId.trim() || undefined,
      status: normalizedStatus,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
  }, [studentName, studentId, status, dateFrom, dateTo]);

  const logsQuery = useQuery({
    queryKey: ["admin-payment-logs", filters],
    queryFn: () => getPaymentLogs(filters),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Payment Attempts"
        subtitle="Audit trail for all payment attempts, successful or failed."
      />

      <Card title="Filters" subtitle="Narrow down payment attempts">
        <div className="grid gap-4 md:grid-cols-5">
          <Input
            label="Search Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Student name"
          />
          <Input
            label="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="UUID"
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </Select>
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      <Card title="Payment Logs" subtitle="Latest payment attempts">
        {logsQuery.isLoading ? (
          <LoadingState label="Loading payment logs" />
        ) : logsQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load payment logs.</p>
        ) : logsQuery.data && logsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Registration No</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Transaction</th>
                  <th className="py-2 pr-4">Receipt</th>
                  <th className="py-2 pr-4">Error</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {logsQuery.data.map((log: any) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{log.studentName ?? "—"}</td>
                    <td className="py-3 pr-4">{log.rollNumber ?? "Pending"}</td>
                    <td className="py-3 pr-4">{formatAmount(Number(log.amount))}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge variant={log.status === "SUCCESS" ? "success" : "danger"}>
                        {log.status}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="py-3 pr-4">{log.transactionId ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {log.status === "SUCCESS" && log.paymentId ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                const blob = await downloadPaymentReceipt(log.paymentId);
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, "_blank", "noopener,noreferrer");
                                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                              } catch (err: any) {
                                toastUtils.error(err?.response?.data?.message ?? "Unable to view receipt");
                              }
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const blob = await downloadPaymentReceipt(log.paymentId);
                                const url = window.URL.createObjectURL(blob);
                                const anchor = document.createElement("a");
                                anchor.href = url;
                                anchor.download = `receipt_${log.paymentId}.pdf`;
                                anchor.click();
                                window.URL.revokeObjectURL(url);
                              } catch (err: any) {
                                toastUtils.error(err?.response?.data?.message ?? "Unable to download receipt");
                              }
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-rose-600">{log.errorMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No payment logs found.</p>
        )}
      </Card>
    </div>
  );
}
