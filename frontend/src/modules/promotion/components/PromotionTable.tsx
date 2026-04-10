import React from "react";

import Table from "./Table";
import EmptyState from "./EmptyState";

type Props<T> = {
  columns: string[];
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};

export default function PromotionTable<T>({
  columns,
  rows,
  renderRow,
  emptyTitle = "No records",
  emptyDescription = "Data will appear once available.",
}: Props<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <Table columns={columns}>{rows.map(renderRow)}</Table>;
}
