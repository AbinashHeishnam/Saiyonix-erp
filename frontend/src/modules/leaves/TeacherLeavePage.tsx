import { useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import StatusBadge from "../../components/StatusBadge";
import Textarea from "../../components/Textarea";
import Modal from "../../components/Modal";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";

type TeacherLeave = {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  leaveType?: string | null;
  status: string;
  attachmentUrl?: string | null;
  approvedAt?: string | null;
  adminRemarks?: string | null;
  teacher?: { fullName?: string | null; photoUrl?: string | null };
};

type FormState = {
  fromDate: string;
  toDate: string;
  reason: string;
  leaveType: string;
};

const emptyForm: FormState = {
  fromDate: "",
  toDate: "",
  reason: "",
  leaveType: "",
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

export default function TeacherLeavePage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TeacherLeave | null>(null);

  const { data, loading, error: loadError, refresh } = useAsync(async () => {
    const res = await api.get("/teacher/leave/my", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data;
    if (Array.isArray(payload)) return payload;
    return payload?.items ?? payload?.data ?? [];
  }, []);

  const items = useMemo(() => {
    const list = (data ?? []) as TeacherLeave[];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((leave) =>
      [leave.reason, leave.leaveType, leave.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [data, query]);

  const handleChange = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.fromDate || !form.toDate || !form.reason.trim()) {
        setError("From Date, To Date, and Reason are required.");
        return;
      }
      const from = new Date(form.fromDate);
      const to = new Date(form.toDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        setError("Please enter valid dates.");
        return;
      }
      if (to < from) {
        setError("To Date must be on or after From Date.");
        return;
      }

      const formData = new FormData();
      formData.append("fromDate", form.fromDate);
      formData.append("toDate", form.toDate);
      formData.append("reason", form.reason);
      if (form.leaveType) formData.append("leaveType", form.leaveType);
      if (file) formData.append("attachment", file);

      await safeApiCall(
        () => api.post("/teacher/leave/apply", formData),
        { loading: "Submitting leave request...", success: "Leave request submitted" }
      );
      setForm(emptyForm);
      setFile(null);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to submit leave request."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title="My Leaves" subtitle="Apply for leave and track approvals." />

      <Card title="Apply Leave">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Input
            label="From Date"
            type="date"
            value={form.fromDate}
            onChange={(event) => handleChange("fromDate")(event.target.value)}
          />
          <Input
            label="To Date"
            type="date"
            value={form.toDate}
            onChange={(event) => handleChange("toDate")(event.target.value)}
          />
          <Select
            label="Leave Type"
            value={form.leaveType}
            onChange={(event) => handleChange("leaveType")(event.target.value)}
          >
            <option value="">Select</option>
            <option value="SICK">Sick</option>
            <option value="CASUAL">Casual</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="OTHER">Other</option>
          </Select>
          <div>
            <label className="text-xs font-semibold text-ink-500">Attachment (optional)</label>
            <input
              type="file"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="lg:col-span-2">
            <Textarea
              label="Reason"
              value={form.reason}
              onChange={(event) => handleChange("reason")(event.target.value)}
              placeholder="Explain your leave request"
              rows={3}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSubmit} loading={saving}>
            Submit Leave
          </Button>
          {error && <p className="text-sm text-sunrise-600">{error}</p>}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <Input
            label="Search"
            placeholder="Search by reason, type, or status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading ? (
            <p className="text-sm text-ink-500">Loading leaves...</p>
          ) : loadError ? (
            <p className="text-sm text-sunrise-600">{loadError}</p>
          ) : items.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((leave) => (
                <button
                  key={leave.id}
                  type="button"
                  onClick={() => setSelected(leave)}
                  className="text-left rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition hover:shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
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
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-500">No leave requests yet.</p>
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
                {selected.teacher?.photoUrl ? (
                  <SecureImage
                    fileUrl={selected.teacher.photoUrl}
                    alt={selected.teacher?.fullName ?? "Teacher"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
                    {(selected.teacher?.fullName ?? "T").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{selected.teacher?.fullName ?? "Teacher"}</p>
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
