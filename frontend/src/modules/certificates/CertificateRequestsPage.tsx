import { useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";

type AdminRequest = {
  id: string;
  type: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  student: {
    id: string;
    fullName: string;
    admissionNumber?: string | null;
    registrationNumber?: string | null;
    className?: string | null;
    sectionName?: string | null;
  };
};

export default function CertificateRequestsPage() {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data, loading, refresh } = useAsync(async () => {
    const res = await api.get("/admin/certificate/requests");
    return res.data?.data ?? res.data;
  }, []);

  const requests = Array.isArray(data) ? (data as AdminRequest[]) : [];

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await safeApiCall(
        () => api.post("/admin/certificate/approve", { requestId }),
        { loading: "Approving certificate...", success: "Certificate approved" }
      );
      await refresh();
    } catch (err) {
      // Handled by toast
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = window.prompt("Enter rejection reason");
    if (!reason) return;

    setProcessingId(requestId);
    try {
      await safeApiCall(
        () => api.post("/admin/certificate/reject", { requestId, rejectedReason: reason }),
        { loading: "Rejecting request...", success: "Request rejected" }
      );
      await refresh();
    } catch (err) {
      // Handled by toast
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Certificate Requests" subtitle="Approve or reject certificate requests" />
      <Card>

        {loading ? (
          <p className="text-sm text-slate-500">Loading requests...</p>
        ) : requests.length ? (
          <div className="grid gap-3">
            {requests.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {req.student.fullName} • {req.type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {req.student.className ?? "—"} {req.student.sectionName ? `• ${req.student.sectionName}` : ""}
                    </p>
                    {req.reason && <p className="mt-1 text-xs text-slate-500">Reason: {req.reason}</p>}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {req.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleApprove(req.id)}
                    loading={processingId === req.id}
                    disabled={req.status !== "PENDING" || (processingId !== null && processingId !== req.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleReject(req.id)}
                    loading={processingId === req.id}
                    disabled={req.status !== "PENDING" || (processingId !== null && processingId !== req.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No certificate requests.</p>
        )}
      </Card>
    </div>
  );
}
