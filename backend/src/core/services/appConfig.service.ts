import prisma from "@/core/db/prisma";

const CACHE_TTL_MS = 60_000;

type CachedValue = {
  value: string | null;
  expiresAt: number;
};

const cache = new Map<string, CachedValue>();

function isFresh(entry: CachedValue | undefined) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export async function getConfig(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (isFresh(cached)) {
    return cached!.value;
  }

  const record = await prisma.appConfig.findUnique({
    where: { key },
    select: { value: true },
  });

  const value = record?.value ?? null;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function getConfigs(keys: string[]): Promise<Record<string, string | null>> {
  const now = Date.now();
  const result: Record<string, string | null> = {};
  const missing: string[] = [];

  for (const key of keys) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      result[key] = cached.value;
    } else {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: missing } },
      select: { key: true, value: true },
    });

    const found = new Map(rows.map((row) => [row.key, row.value]));
    for (const key of missing) {
      const value = found.get(key) ?? null;
      cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
      result[key] = value;
    }
  }

  return result;
}

export function invalidateConfigCache(keys?: string[]) {
  if (!keys) {
    cache.clear();
    return;
  }
  for (const key of keys) {
    cache.delete(key);
  }
}
