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

const pool = new Pool({
  connectionString: buildDatabaseUrl(),
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
