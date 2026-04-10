export function logSecurity(event: string, meta?: Record<string, unknown>) {
  console.warn("[SECURITY]", {
    event,
    ...(meta ?? {}),
    time: new Date().toISOString(),
  });
}
