export function normalizeDate(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
export function buildDateRange(fromDate, toDate) {
    const dates = [];
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
