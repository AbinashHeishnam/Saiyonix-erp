export function formatTime(raw?: string | null) {
  if (!raw) return "—";
  if (raw.includes("T")) {
    const timePart = raw.split("T")[1]?.split(".")[0] ?? "";
    if (timePart) {
      const [h, m] = timePart.split(":");
      const hours = Number(h);
      const minutes = Number(m);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        const hour12 = ((hours + 11) % 12) + 1;
        const suffix = hours >= 12 ? "PM" : "AM";
        return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
      }
    }
  }
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return raw;
  const hour12 = ((hours + 11) % 12) + 1;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
