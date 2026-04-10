import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";

import LoadingState from "../../components/LoadingState";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import { usePrint } from "../../hooks/usePrint";
import { getNotice } from "../../services/api/notices";
import api from "../../services/api/client";
import { useSchoolBranding } from "../../hooks/useSchoolBranding";

function getFileName(url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const name = clean.split("/").pop() ?? "";
  return decodeURIComponent(name) || null;
}

function isImage(url?: string | null) {
  if (!url) return false;
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NoticeViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { branding } = useSchoolBranding();
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const handlePrint = usePrint(printRootRef);

  const { data, loading, error } = useAsync(async () => {
    if (!id) return null;
    const notice = await getNotice(id);

    // Resolve class / section name when targeted
    let targetLabel = "All Students, Teachers & Parents";

    if (notice.targetType === "CLASS" && notice.targetClassId) {
      try {
        const res = await api.get("/classes", { params: { page: 1, limit: 200 } });
        const classes = res.data?.data ?? res.data?.data?.data ?? res.data ?? [];
        const list = Array.isArray(classes) ? classes : classes?.data ?? [];
        const match = list.find((c: { id: string }) => c.id === notice.targetClassId);
        targetLabel = match ? `Class ${match.className}` : "Specific Class";
      } catch {
        targetLabel = "Specific Class";
      }
    } else if (notice.targetType === "SECTION" && notice.targetSectionId) {
      try {
        const res = await api.get("/sections", { params: { page: 1, limit: 200 } });
        const sections = res.data?.data ?? res.data?.data?.data ?? res.data ?? [];
        const list = Array.isArray(sections) ? sections : sections?.data ?? [];
        const match = list.find((s: { id: string }) => s.id === notice.targetSectionId);
        if (match) {
          const className = match.class?.className ?? "";
          const sectionName = match.sectionName ?? "";
          targetLabel = className ? `Class ${className} – ${sectionName}` : sectionName;
        } else {
          targetLabel = "Specific Section";
        }
      } catch {
        targetLabel = "Specific Section";
      }
    } else if (notice.targetType === "ROLE" && notice.targetRole) {
      const r = notice.targetRole as string;
      targetLabel = `${r.charAt(0)}${r.slice(1).toLowerCase()}s`;
    } else if (notice.targetType === "ALL") {
      targetLabel = "All Students, Teachers & Parents";
    }

    return { ...notice, targetLabel };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingState label="Loading notice" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-600">{error ?? "Notice not found"}</p>
        <button onClick={() => navigate(-1)} className="text-sm font-medium text-slate-600 hover:text-slate-900">&larr; Go back</button>
      </div>
    );
  }

  const attachments = (data.attachments ?? []) as string[];
  const imageAttachments = attachments.filter(isImage);
  const fileAttachments = attachments.filter((a) => !isImage(a));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800 print-hide"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to notices
      </button>

      {/* Notice paper */}
      <div
        ref={printRootRef}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print-root print-color print-no-shadow print-no-border-radius"
      >

        {/* ===== HEADER BAND ===== */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
              {branding.logoUrl ? (
                <SecureImage fileUrl={branding.logoUrl} alt="School logo" className="h-full w-full object-contain bg-white" />
              ) : (
                <span className="text-sm font-extrabold text-white">
                  {(branding.schoolName ?? "S").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-[15px] font-bold uppercase tracking-wide text-slate-800">
              {branding.schoolName}
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              {branding.schoolAddress || "School Notice"}
            </p>
          </div>
        </div>

        {/* ===== NOTICE TITLE BAR ===== */}
        <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-center">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Notice
            </span>
          </div>
        </div>

        {/* ===== META ROW ===== */}
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-6 py-4 text-[12px] text-slate-500 sm:grid-cols-3 sm:px-8">
          <div>
            <span className="font-semibold text-slate-400">Date:</span>{" "}
            <span className="font-medium text-slate-700">{formatDate(data.publishedAt)}</span>
          </div>
          <div className="text-center">
            <span className="font-semibold text-slate-400">Type:</span>{" "}
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {data.noticeType ?? "GENERAL"}
            </span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-slate-400">To:</span>{" "}
            <span className="font-medium text-slate-700">{data.targetLabel}</span>
          </div>
        </div>

        {/* ===== NOTICE BODY ===== */}
        <div className="px-6 py-6 sm:px-8 sm:py-8">

          {/* Subject line */}
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject</p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-slate-900 sm:text-xl">{data.title}</h2>
          </div>

          {/* Divider */}
          <div className="mb-6 h-px bg-slate-100" />

          {/* Content */}
          <div className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">
            {data.content}
          </div>

          {/* Image attachments — rendered inline */}
          {imageAttachments.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Attached Images</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {imageAttachments.map((url, idx) => (
                  <SecureLink
                    key={`img-${idx}`}
                    fileUrl={url}
                    fileName={getFileName(url) ?? `Image ${idx + 1}`}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md"
                  >
                    <SecureImage
                      fileUrl={url}
                      alt={getFileName(url) ?? `Attachment ${idx + 1}`}
                      className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-600">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {getFileName(url) ?? `Image ${idx + 1}`}
                    </div>
                  </SecureLink>
                ))}
              </div>
            </div>
          )}

          {/* File attachments */}
          {fileAttachments.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Attachments</p>
              <div className="flex flex-col gap-2">
                {fileAttachments.map((url, idx) => (
                  <SecureLink
                    key={`file-${idx}`}
                    fileUrl={url}
                    fileName={getFileName(url) ?? "Attachment"}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:border-slate-300 hover:bg-slate-100"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[16px] shadow-sm">
                      {url.toLowerCase().includes(".pdf") ? "📄" : "📎"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{getFileName(url) ?? "Attachment"}</p>
                      <p className="text-[11px] text-slate-400">Click to download</p>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </SecureLink>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8">
          <div className="flex flex-col items-end text-right">
            <p className="text-[12px] font-semibold text-slate-600">Issued by</p>
            <p className="mt-0.5 text-[13px] font-bold text-slate-800">School Administration</p>
            <p className="text-[11px] text-slate-400">
              {branding.schoolName}
              {branding.schoolAddress ? `, ${branding.schoolAddress}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Print */}
      <div className="mt-4 flex justify-end gap-2 print-hide">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print
        </button>
      </div>

    </div>
  );
}
