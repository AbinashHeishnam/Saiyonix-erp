export function logSecurity(event, meta) {
    console.warn("[SECURITY]", {
        event,
        ...(meta ?? {}),
        time: new Date().toISOString(),
    });
}
