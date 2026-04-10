export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    syncTimestamp?: string;
  };
};
