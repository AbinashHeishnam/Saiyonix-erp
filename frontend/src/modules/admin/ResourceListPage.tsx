
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Table from "../../components/Table";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type ColumnDef =
  | string
  | {
      key: string;
      label: string;
    };

type ResourceListPageProps = {
  title: string;
  description: string;
  endpoint: string;
  columns?: ColumnDef[];
  primaryKey?: string;
};

function toDisplayValue(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatLabel(key: string) {
  const segment = key.split(".").filter(Boolean).pop() ?? key;
  const withSpaces = segment.replace(/_/g, " ").replace(/([A-Z])/g, " $1");
  return withSpaces.replace(/\s+/g, " ").trim();
}

function getValueByPath(row: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) {
      const index = Number(part);
      return Number.isInteger(index) ? acc[index] : undefined;
    }
    if (typeof acc === "object" && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, row);
}

export default function ResourceListPage({
  title,
  description,
  endpoint,
  columns,
  primaryKey,
}: ResourceListPageProps) {
  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get(endpoint, { params: { page: 1, limit: 50 } });
    const payload = res.data?.data ?? res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return payload?.items ?? [];
  }, [endpoint]);

  const safeData = Array.isArray(data) ? data : [];
  const derivedColumns = columns && columns.length
    ? columns
    : safeData[0]
    ? (() => {
        const keys = Object.keys(safeData[0] as Record<string, unknown>);
        const filtered = keys.filter((key) => key !== "id" && !key.endsWith("Id"));
        return (filtered.length ? filtered : keys).slice(0, 5);
      })()
    : [];

  const columnDefs = derivedColumns.map((col) =>
    typeof col === "string"
      ? {
          key: col,
          label: formatLabel(col),
        }
      : col
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={description} />
      <Card title={`${title} Records`}>
        {loading ? (
          <LoadingState label={`Loading ${title.toLowerCase()}`} />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : safeData.length ? (
          <Table columns={columnDefs.map((col) => col.label)}>
            {safeData.map((row: Record<string, unknown>, index: number) => {
              const key = primaryKey && row[primaryKey] ? String(row[primaryKey]) : row.id ? String(row.id) : String(index);
              return (
                <tr key={key} className="rounded-lg bg-white shadow-soft">
                  {columnDefs.map((col) => (
                    <td key={col.key} className="px-3 py-3 text-sm text-ink-700">
                      {toDisplayValue(getValueByPath(row, col.key))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState title="No records yet" description="Once data is available, it will appear here." />
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
          <span>Endpoint: {endpoint}</span>
          <button
            type="button"
            className="rounded-full bg-ink-50 px-3 py-1 text-ink-500 hover:bg-ink-100"
            onClick={refresh}
          >
            Refresh
          </button>
        </div>
      </Card>
    </div>
  );
}
