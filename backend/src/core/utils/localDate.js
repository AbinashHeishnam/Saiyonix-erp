export function getLocalDateParts(date, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    return {
        year: Number(map.get("year")),
        month: Number(map.get("month")),
        day: Number(map.get("day")),
    };
}
export function toLocalDateOnly(value, timeZone, errorFactory) {
    const raw = value instanceof Date ? value : value ? new Date(value) : new Date();
    if (Number.isNaN(raw.getTime())) {
        throw errorFactory ? errorFactory("Invalid date") : new Error("Invalid date");
    }
    const { year, month, day } = getLocalDateParts(raw, timeZone);
    return new Date(Date.UTC(year, month - 1, day));
}
export function formatLocalDate(value, timeZone, errorFactory) {
    const raw = value instanceof Date ? value : value ? new Date(value) : new Date();
    if (Number.isNaN(raw.getTime())) {
        throw errorFactory ? errorFactory("Invalid date") : new Error("Invalid date");
    }
    const { year, month, day } = getLocalDateParts(raw, timeZone);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}
export function formatLocalDateKey(value, timeZone) {
    return formatLocalDate(value, timeZone);
}
