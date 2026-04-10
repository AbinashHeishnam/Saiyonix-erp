import { useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import api from "../../services/api/client";

type ImportError = {
  row: number;
  reason: string;
  data: Record<string, string>;
};

type ImportResult = {
  successCount: number;
  failureCount: number;
  failures: ImportError[];
};

type UiState = "idle" | "loading" | "success" | "partial" | "error";

type PreviewResult = {
  totalRows: number;
  validRows: number;
  invalidRows: ImportError[];
};

export default function TeacherBulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<UiState>("idle");

  const downloadTemplate = async () => {
    setError(null);
    setResult(null);
    const res = await api.get("/teacher-bulk-imports/template");
    const templateText = res.data?.data?.template ?? res.data?.template ?? "";
    setTemplate(templateText);
    const blob = new Blob([templateText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teacher-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const previewTeachers = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }
    setState("loading");
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const payload = await file.arrayBuffer();
      const res = await api.post("/teacher-bulk-imports/preview", payload, {
        headers: { "Content-Type": file.type || "text/csv" },
      });
      const data = (res.data?.data ?? res.data) as PreviewResult;
      setPreview(data);
      setState("idle");
    } catch (err: unknown) {
      setState("error");
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Preview failed. Try again."
      );
    }
  };

  const importTeachers = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const payload = await file.arrayBuffer();
      const res = await api.post("/teacher-bulk-imports", payload, {
        headers: { "Content-Type": file.type || "text/csv" },
      });
      const data = (res.data?.data ?? res.data) as ImportResult;
      setResult(data);
      if (data.failureCount > 0) {
        setState("partial");
      } else {
        setState("success");
      }
    } catch (err: unknown) {
      setState("error");
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Import failed. Try again."
      );
    }
  };

  const downloadFailedCsv = async () => {
    if (!result?.failures?.length) return;
    const res = await api.post(
      "/teacher-bulk-imports/failed-csv",
      { errors: result.failures },
      { responseType: "blob" }
    );
    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "failed_teachers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const errorRows = result?.failures ?? [];
  const previewInvalidRows = preview?.invalidRows ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teacher Bulk Import"
        subtitle="Upload teachers via CSV and get per-row feedback."
      />

      <Card title="Template">
        <p className="text-sm text-ink-500">
          Download the CSV template, fill in the teachers, and upload the file.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={downloadTemplate}>
            Download Template
          </Button>
        </div>
        {template ? (
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-ink-50 p-4 text-xs text-ink-600">
            {template}
          </pre>
        ) : null}
      </Card>

      <Card title="Upload CSV">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
              setError(null);
            }}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={previewTeachers} disabled={state === "loading"}>
              {state === "loading" ? "Processing rows..." : "Preview"}
            </Button>
            <Button
              variant="secondary"
              onClick={importTeachers}
              disabled={state === "loading" || !preview}
            >
              {state === "loading" ? "Processing rows..." : "Proceed Import"}
            </Button>
          </div>
          {state === "loading" ? (
            <p className="text-xs text-ink-500">Processing rows...</p>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-sunrise-600">{error}</p> : null}
      </Card>

      {preview ? (
        <Card title="Preview Summary">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="text-ink-700">✔ {preview.validRows} valid rows</div>
            <div className="text-sunrise-600">❌ {preview.invalidRows.length} invalid rows</div>
          </div>

          {previewInvalidRows.length > 0 ? (
            <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-ink-100">
              <Table columns={["Row Number", "Error Reason"]}>
                {previewInvalidRows.map((row) => (
                  <tr key={`${row.row}-${row.reason}`} className="bg-sunrise-50">
                    <td className="px-3 py-2">{row.row}</td>
                    <td className="px-3 py-2 text-sunrise-600">{row.reason}</td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <Card title="Import Summary">
          {result.failureCount === 0 ? (
            <div className="mt-2 rounded-xl bg-jade-50 px-4 py-3 text-sm text-jade-700">
              Import completed successfully.
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-6 text-sm">
            <div className="text-ink-700">✔ {result.successCount} teachers imported</div>
            <div className="text-sunrise-600">❌ {result.failureCount} failed</div>
          </div>

          {errorRows.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              <div className="max-h-64 overflow-auto rounded-xl border border-ink-100">
                <Table columns={["Row Number", "Error Reason", ""]}>
                  {errorRows.map((row) => (
                    <tr key={`${row.row}-${row.reason}`} className="bg-white">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2 text-sunrise-600">{row.reason}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(row.reason)}
                          className="text-xs font-semibold text-ink-600 hover:text-ink-900"
                        >
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
              <div>
                <Button variant="secondary" onClick={downloadFailedCsv}>
                  Download Failed CSV
                </Button>
                <Button
                  className="ml-3"
                  variant="ghost"
                  onClick={() => {
                    setResult(null);
                    setPreview(null);
                    setFile(null);
                  }}
                >
                  Fix & Re-upload
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
