import { z } from "zod";

import { ApiError } from "@/utils/apiError";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const paginationQuerySchema = paginationSchema.strict();

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

export function getPagination(query: any) {
  const page = Math.max(Number(query?.page) || 1, 1);
  const limit = Math.min(Number(query?.limit) || 20, 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
}

export function parsePagination(query: unknown, defaults = { page: 1, limit: 20 }) {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  try {
    return getPagination(parsed.data);
  } catch (err) {
    const page = parsed.data.page ?? defaults.page;
    const limit = parsed.data.limit ?? defaults.limit;
    const skip = (page - 1) * limit;
    return { page, limit, skip, take: limit };
  }
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
