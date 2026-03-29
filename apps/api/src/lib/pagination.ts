/**
 * Parsed pagination parameters with computed skip/take for Prisma.
 */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Pagination metadata included in list responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse page and limit from query parameters with sensible defaults and clamping.
 * - page: defaults to 1, minimum 1
 * - limit: defaults to defaultLimit, clamped to 1-maxLimit
 *
 * @param query - The query string parameters.
 * @param options - Optional overrides for default and max limit.
 * @returns Parsed pagination with skip/take for Prisma.
 */
export function parsePagination(
  query: { page?: string; limit?: string },
  options?: { defaultLimit?: number; maxLimit?: number }
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 50;
  const page = Math.max(1, parseInt(query.page || "1") || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.limit || String(defaultLimit)) || defaultLimit),
  );
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * Compute pagination metadata for the response.
 *
 * @param page - Current page number.
 * @param limit - Items per page.
 * @param total - Total item count.
 * @returns Pagination metadata object.
 */
export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
