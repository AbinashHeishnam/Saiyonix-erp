export function enforcePagination(query: any) {
  const page = Math.max(Number(query?.page) || 1, 1);
  const limit = Math.min(Number(query?.limit) || 20, 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
