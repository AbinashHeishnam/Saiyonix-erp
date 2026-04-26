export async function withTiming(label, fn) {
    const start = Date.now();
    try {
        return await fn();
    }
    finally {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.warn(`[slow] ${label} took ${duration}ms`);
        }
    }
}
export async function withConsoleTime(label, fn) {
    console.time(label);
    try {
        return await fn();
    }
    finally {
        console.timeEnd(label);
    }
}
export function chunkArray(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
