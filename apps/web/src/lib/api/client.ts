import axios, { AxiosError } from 'axios';
import { apiErrorResponseSchema } from '@visionattend/shared';

/**
 * The single HTTP client for the app. Phase 2 adds interceptors here for the
 * access token and silent refresh, so features never deal with auth.
 */
export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

/** Normalized error thrown to feature code, whatever went wrong underneath. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    const parsed = apiErrorResponseSchema.safeParse(error.response?.data);
    if (parsed.success) {
      const { message, code, requestId } = parsed.data.error;
      return new ApiError(message, code, error.response?.status, requestId);
    }
    if (!error.response) {
      return new ApiError('Cannot reach the VisionAttend API', 'NETWORK_ERROR');
    }
    return new ApiError(
      `Unexpected response (${error.response.status})`,
      'HTTP_ERROR',
      error.response.status,
    );
  }
  return new ApiError('Unexpected error', 'UNKNOWN');
}
