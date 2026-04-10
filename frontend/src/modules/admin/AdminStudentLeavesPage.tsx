import { useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";

type StudentLeave = {
  id: string;
  studentId: string;
  student?: { fullName?: string | null; profile?: { profilePhotoUrl?: string | null } | null };
  fromDate: string;
  toDate: string;
  reason: string;
  leaveType?: string | null;
  status: string;
  attachmentUrl?: string | null;
  adminRemarks?: string | null;
  approvedAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statusVariant(status?: string) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function getFileName(url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const name = clean.split("/").pop() ?? "";
  return decodeURIComponent(name) || null;
}

function getFileIcon(url?: string | null) {
  if (!url) return null;
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📄";
  if (["jpg", "jpeg", "png"].includes(ext)) return "🖼";
  return "📎";
}

export default function AdminStudentLeavesPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudentLeave | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get("/admin/student-leaves", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data;
    if (Array.isArray(payload)) return payload;
    return payload?.items ?? payload?.data ?? [];
  }, []);

  const items = useMemo(() => {
    const list = (data ?? []) as StudentLeave[];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((leave) =>
      [
        leave.student?.fullName,
        leave.reason,
        leave.leaveType,
        leave.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [data, query]);

  const handleUpdate = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    const remarks = window.prompt("Remarks (optional):") ?? undefined;

    setProcessingId(leaveId);
    try {
      await safeApiCall(
        () => api.patch(`/admin/student-leave/${leaveId}`, { status, remarks }),
        {
          loading: status === "APPROVED" ? "Approving leave..." : "Rejecting leave...",
          success: `Leave ${status.toLowerCase()} successfully`
        }
      );
      await refresh();
    } catch {
      // Handled by toast
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Student Leave Management"
        subtitle="Approve or reject student leave requests."
      />

      <Card>
        <div className="flex flex-col gap-4">
          <Input
            label="Search"
            placeholder="Search by student, reason, or status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading ? (
            <p className="text-sm text-ink-500">Loading leaves...</p>
          ) : error ? (
            <p className="text-sm text-sunrise-600">{error}</p>
          ) : items.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((leave) => (
                <button
                  key={leave.id}
                  className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
                  type="button"
                  onClick={() => setSelected(leave)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {leave.student?.fullName ?? "Student"}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {leave.leaveType ?? "Leave"} • {leave.reason}
                      </p>
                    </div>
                    <StatusBadge variant={statusVariant(leave.status)}>
                      {leave.status ?? "PENDING"}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                    <span>Attachment</span>
                    {leave.attachmentUrl ? (
                      <div className="flex items-center gap-2">
                        <span>{getFileIcon(leave.attachmentUrl)}</span>
                        <span className="text-ink-600">
                          {getFileName(leave.attachmentUrl) ?? "Attachment"}
                        </span>
                        <SecureLink
                          fileUrl={leave.attachmentUrl}
                          fileName={getFileName(leave.attachmentUrl) ?? "Attachment"}
                          className="font-semibold text-ink-700"
                        >
                          View
                        </SecureLink>
                        <SecureLink
                          fileUrl={leave.attachmentUrl}
                          fileName={getFileName(leave.attachmentUrl) ?? "Attachment"}
                          className="font-semibold text-emerald-700"
                        >
                          Download
                        </SecureLink>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      loading={processingId === leave.id}
                      disabled={leave.status !== "PENDING" || (processingId !== null && processingId !== leave.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUpdate(leave.id, "APPROVED");
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      loading={processingId === leave.id}
                      disabled={leave.status !== "PENDING" || (processingId !== null && processingId !== leave.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUpdate(leave.id, "REJECTED");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-500">No leave requests found.</p>
          )}
        </div>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Leave Details"
        size="md"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white">
                {selected.student?.profile?.profilePhotoUrl ? (
                  <SecureImage
                    fileUrl={selected.student.profile.profilePhotoUrl}
                    alt={selected.student?.fullName ?? "Student"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
                    {(selected.student?.fullName ?? "S").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{selected.student?.fullName ?? "Student"}</p>
                <p className="text-xs text-ink-500">Leave request details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-400">Date Range</p>
                <p className="text-sm font-medium text-ink-800">
                  {formatDate(selected.fromDate)} → {formatDate(selected.toDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400">Status</p>
                <StatusBadge variant={statusVariant(selected.status)} dot={false}>
                  {selected.status ?? "PENDING"}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-ink-400">Leave Type</p>
                <p className="text-sm font-medium text-ink-800">{selected.leaveType ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-400">Approved At</p>
                <p className="text-sm font-medium text-ink-800">
                  {formatDate(selected.approvedAt)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-ink-400">Reason</p>
              <p className="text-sm font-medium text-ink-800 whitespace-pre-wrap">
                {selected.reason ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Admin Remarks</p>
              <p className="text-sm font-medium text-ink-800 whitespace-pre-wrap">
                {selected.adminRemarks ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white p-4">
              <p className="text-xs font-semibold text-ink-400">Attachment</p>
              {selected.attachmentUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span>{getFileIcon(selected.attachmentUrl)}</span>
                  <span className="text-ink-700">
                    {getFileName(selected.attachmentUrl) ?? "Attachment"}
                  </span>
                  <SecureLink
                    fileUrl={selected.attachmentUrl}
                    fileName={getFileName(selected.attachmentUrl) ?? "Attachment"}
                    className="font-semibold text-ink-700"
                  >
                    View
                  </SecureLink>
                  <SecureLink
                    fileUrl={selected.attachmentUrl}
                    fileName={getFileName(selected.attachmentUrl) ?? "Attachment"}
                    className="font-semibold text-emerald-700"
                  >
                    Download
                  </SecureLink>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-500">No attachment uploaded.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
