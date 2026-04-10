import { getRedis } from "@/core/redis";

const CACHE_TIMEOUT_MS = Number(process.env.CACHE_TIMEOUT_MS ?? 2000);
const CACHE_DEBUG = process.env.CACHE_DEBUG === "true";
const CACHE_METRICS = process.env.CACHE_METRICS === "true";
const CACHE_VERSION_TTL_MS = Number(process.env.CACHE_VERSION_TTL_MS ?? 30000);

type CacheMetricCounters = {
  hits: number;
  misses: number;
};

const cacheMetrics: CacheMetricCounters = {
  hits: 0,
  misses: 0,
};

const versionCache = new Map<string, { value: number; expiresAt: number }>();

function cacheLog(...args: unknown[]) {
  if (!CACHE_DEBUG) return;
  console.log(...args);
}

function getCachedVersion(key: string) {
  const entry = versionCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    versionCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedVersion(key: string, value: number) {
  versionCache.set(key, { value, expiresAt: Date.now() + CACHE_VERSION_TTL_MS });
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${CACHE_TIMEOUT_MS}ms`));
    }, CACHE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  cacheLog("[cache:get] start", key);
  const redis = await getRedis();
  if (!redis) {
    return null;
  }
  try {
    const raw = await withTimeout("cacheGet", redis.get(key));
    if (!raw) {
      cacheMetrics.misses += 1;
      return null;
    }
    try {
      cacheMetrics.hits += 1;
      return JSON.parse(raw) as T;
    } catch {
      cacheMetrics.misses += 1;
      return null;
    }
  } catch (err) {
    console.warn("[cache:get] error", key, err);
    return null;
  } finally {
    cacheLog("[cache:get] end", key);
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300) {
  cacheLog("[cache:set] start", key);
  const redis = await getRedis();
  if (!redis) {
    return;
  }
  try {
    const payload = JSON.stringify(value);
    await withTimeout("cacheSet", redis.set(key, payload, "EX", ttlSeconds));
  } catch (err) {
    console.warn("[cache:set] error", key, err);
  } finally {
    cacheLog("[cache:set] end", key);
  }
}

export async function cacheInvalidateByPrefix(prefix: string) {
  cacheLog("[cache:invalidate] start", prefix);
  const redis = await getRedis();
  if (!redis) {
    return;
  }
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await withTimeout(
        "cacheInvalidate",
        redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 500)
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await withTimeout("cacheInvalidateDel", redis.del(keys));
      }
    } while (cursor !== "0");
  } catch (err) {
    console.warn("[cache:invalidate] error", prefix, err);
  } finally {
    cacheLog("[cache:invalidate] end", prefix);
  }
}

export async function getCacheVersion(endpoint: string, examId: string) {
  const versionKey = `cachever:${endpoint}:${examId}`;
  const cached = getCachedVersion(versionKey);
  if (cached != null) {
    return cached;
  }

  const redis = await getRedis();
  if (!redis) {
    return 1;
  }

  try {
    const raw = await withTimeout("cacheVersionGet", redis.get(versionKey));
    if (raw) {
      const parsed = Number(raw);
      const version = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      setCachedVersion(versionKey, version);
      return version;
    }

    await withTimeout("cacheVersionInit", redis.set(versionKey, "1", "NX"));
    setCachedVersion(versionKey, 1);
    return 1;
  } catch (err) {
    console.warn("[cache:version:get] error", versionKey, err);
    return 1;
  }
}

export async function bumpCacheVersion(endpoint: string, examId: string) {
  const versionKey = `cachever:${endpoint}:${examId}`;
  const redis = await getRedis();
  if (!redis) {
    return 1;
  }
  try {
    const nextVersion = await withTimeout(
      "cacheVersionBump",
      redis.incr(versionKey)
    );
    setCachedVersion(versionKey, nextVersion);
    return nextVersion;
  } catch (err) {
    console.warn("[cache:version:bump] error", versionKey, err);
    return 1;
  }
}

if (CACHE_METRICS) {
  setInterval(() => {
    const total = cacheMetrics.hits + cacheMetrics.misses;
    const hitRate = total > 0 ? (cacheMetrics.hits / total) * 100 : 0;
    console.info("[cache:metrics]", {
      hits: cacheMetrics.hits,
      misses: cacheMetrics.misses,
      hitRate: Number(hitRate.toFixed(2)),
    });
  }, 60_000).unref();
}
