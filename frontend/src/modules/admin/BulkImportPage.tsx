import { useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import Textarea from "../../components/Textarea";
import api from "../../services/api/client";

type BulkImportPageProps = {
  title: string;
  description: string;
  templateEndpoint: string;
  previewEndpoint: string;
  importEndpoint: string;
  format: "raw" | "json";
  accept: string;
};

export default function BulkImportPage({
  title,
  description,
  templateEndpoint,
  previewEndpoint,
  importEndpoint,
  format,
  accept,
}: BulkImportPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const downloadTemplate = async () => {
    setError(null);
    setResult(null);
    const res = await api.get(templateEndpoint);
    const templateText = res.data?.data?.template ?? res.data?.template ?? "";
    setTemplate(templateText);
    const blob = new Blob([templateText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/\s+/g, "-").toLowerCase()}-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (endpoint: string) => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let payload: ArrayBuffer | unknown;
      let headers: Record<string, string> = {};
      if (format === "raw") {
        payload = await file.arrayBuffer();
        headers = { "Content-Type": file.type || "application/octet-stream" };
      } else {
        const text = await file.text();
        payload = JSON.parse(text);
        headers = { "Content-Type": "application/json" };
      }
      const res = await api.post(endpoint, payload, { headers });
      setResult(res.data?.data ?? res.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadFailedCsv = () => {
    if (!result || typeof result !== "object") return;
    const failedCsv = (result as { failedCsv?: string }).failedCsv;
    if (!failedCsv) return;
    const blob = new Blob([failedCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/\s+/g, "-").toLowerCase()}-failed-rows.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={description} />
      <Card title="Template">
        <p className="text-sm text-ink-500">
          Download the latest template and populate it before uploading.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={downloadTemplate}>
            Download Template
          </Button>
        </div>
        {template ? (
          <div className="mt-4">
            <Textarea label="Template Preview" value={template} onChange={() => undefined} />
          </div>
        ) : null}
      </Card>
      <Card title="Upload File">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept={accept}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => upload(previewEndpoint)} disabled={loading}>
              {loading ? "Processing..." : "Preview"}
            </Button>
            <Button variant="secondary" onClick={() => upload(importEndpoint)} disabled={loading}>
              {loading ? "Processing..." : "Import"}
            </Button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-sunrise-600">{error}</p> : null}
        {result ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-ink-50 p-4 text-xs text-ink-600">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
        {result && (result as { failedCsv?: string }).failedCsv ? (
          <div className="mt-3">
            <Button variant="secondary" onClick={downloadFailedCsv}>
              Download Failed Rows CSV
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
