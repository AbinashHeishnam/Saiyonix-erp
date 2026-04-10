import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function buildDatabaseUrl() {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const poolLimit = process.env.DB_POOL_LIMIT ?? "40";
    const poolTimeout = process.env.DB_POOL_TIMEOUT ?? "20";

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", poolLimit);
    }

    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", poolTimeout);
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const poolLimit = Number(process.env.DB_POOL_LIMIT ?? 40);
const poolTimeoutSeconds = Number(process.env.DB_POOL_TIMEOUT ?? 20);
const poolIdleMs = Number(process.env.DB_POOL_IDLE_MS ?? 10000);

const pool = new Pool({
  connectionString: buildDatabaseUrl(),
  max: Number.isFinite(poolLimit) && poolLimit > 0 ? poolLimit : 40,
  idleTimeoutMillis: Number.isFinite(poolIdleMs) && poolIdleMs > 0 ? poolIdleMs : 10000,
  connectionTimeoutMillis:
    Number.isFinite(poolTimeoutSeconds) && poolTimeoutSeconds > 0
      ? poolTimeoutSeconds * 1000
      : 20000,
});

pool.on("error", (err) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[db:pool:error]", err);
  }
});

const adapter = new PrismaPg(pool);

const MAX_SAFE_TAKE = Number(process.env.PRISMA_MAX_TAKE ?? 10000);

function isEmptyWhere(where: unknown) {
  return !where || (typeof where === "object" && Object.keys(where as object).length === 0);
}

function isUnboundedFindMany(args: any) {
  if (!args) return false;
  return isEmptyWhere(args.where) && args.take == null;
}

const prisma = new PrismaClient({
  adapter,
}).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let nextArgs = args;
        if (operation === "findMany" && isUnboundedFindMany(args)) {
          nextArgs = { ...args, take: MAX_SAFE_TAKE };
        }
        return query(nextArgs);
      },
    },
  },
});

export function enforceQueryLimits(args: any) {
  if (!args) return args;
  if (isUnboundedFindMany(args)) {
    return { ...args, take: MAX_SAFE_TAKE };
  }

  return args;
}

export default prisma;
