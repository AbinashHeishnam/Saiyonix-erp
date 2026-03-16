import { z } from "zod";

import { ApiError } from "./apiError";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function parsePagination(query: unknown, defaults = { page: 1, limit: 50 }) {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  const page = parsed.data.page ?? defaults.page;
  const limit = parsed.data.limit ?? defaults.limit;
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
}

export function buildPaginationMeta(
  total: number,
  params: Pick<PaginationParams, "page" | "limit">
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
  };
}

export function buildPaginationMetaWithSync(
  total: number,
  params: Pick<PaginationParams, "page" | "limit">
) {
  return {
    ...buildPaginationMeta(total, params),
    syncTimestamp: new Date().toISOString(),
  };
}
