export function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function buildDateRange(fromDate: Date, toDate: Date): Date[] {
  const dates: Date[] = [];
  const start = normalizeDate(fromDate);
  const end = normalizeDate(toDate);
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor);
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next;
  }

  return dates;
}
