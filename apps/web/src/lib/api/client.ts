import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
  type AuthSessionResponse,
} from '@visionattend/shared';

/**
 * The single HTTP client for the app. It attaches the access token and
 * silently refreshes it, so feature code never deals with auth.
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
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    const parsed = apiErrorResponseSchema.safeParse(error.response?.data);
    if (parsed.success) {
      const { message, code, requestId, details } = parsed.data.error;
      return new ApiError(message, code, error.response?.status, requestId, details);
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

// ───────────────────────────── Session ─────────────────────────────

/**
 * The access token lives only in this module's memory: not in localStorage
 * or sessionStorage, where any injected script could read it. A page reload
 * loses it, and the httpOnly refresh cookie is used to get a new one.
 */
let accessToken: string | null = null;

type SessionListener = (session: AuthSessionResponse | null) => void;
const listeners = new Set<SessionListener>();

export function setSession(session: AuthSessionResponse | null): void {
  accessToken = session?.accessToken ?? null;
  for (const listener of listeners) listener(session);
}

/** AuthProvider subscribes so that a refresh or an expiry updates the UI. */
export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let refreshInFlight: Promise<AuthSessionResponse> | null = null;

async function requestRefresh(): Promise<AuthSessionResponse> {
  const { data } = await apiClient.post<unknown>('/auth/refresh', undefined, {
    skipAuthRefresh: true,
  });
  return authSessionResponseSchema.parse(data);
}

/**
 * Exchanges the refresh cookie for a new session.
 *
 * Every refresh token works only once, and presenting a used one revokes the
 * whole session (theft detection). Two refreshes racing with the same cookie
 * would therefore log the user out, so calls are de-duplicated inside this
 * tab and serialized across tabs with the Web Locks API.
 */
export function refreshSession(): Promise<AuthSessionResponse> {
  refreshInFlight ??= (async () => {
    try {
      const session = navigator.locks
        ? await navigator.locks.request('visionattend-refresh', requestRefresh)
        : await requestRefresh();
      setSession(session);
      return session;
    } catch (error) {
      setSession(null);
      throw toApiError(error);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not try to refresh the session when this request returns 401. */
    skipAuthRefresh?: boolean;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  // Access tokens expire every 15 minutes: refresh once, then replay the request.
  if (error instanceof AxiosError && error.response?.status === 401 && error.config) {
    const config = error.config as RetriableConfig;
    if (!config.skipAuthRefresh && !config._retried) {
      config._retried = true;
      await refreshSession();
      return apiClient.request(config);
    }
  }
  throw error;
});
