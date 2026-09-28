import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthSessionResponse } from '@visionattend/shared';
import {
  apiClient,
  ApiError,
  onSessionChange,
  refreshSession,
  setSession,
  toApiError,
} from './client';

function axiosErrorWith(status: number, data: unknown) {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } satisfies AxiosResponse;
  return new AxiosError('failed', undefined, undefined, undefined, response);
}

describe('toApiError', () => {
  it('maps the API error envelope to an ApiError', () => {
    const error = toApiError(
      axiosErrorWith(404, { error: { code: 'NOT_FOUND', message: 'Nope', requestId: 'r-1' } }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404, requestId: 'r-1' });
  });

  it('reports network failures distinctly', () => {
    expect(toApiError(new AxiosError('Network Error')).code).toBe('NETWORK_ERROR');
  });

  it('handles responses that do not follow the envelope', () => {
    expect(toApiError(axiosErrorWith(502, '<html>bad gateway</html>')).code).toBe('HTTP_ERROR');
  });
});

describe('session refresh', () => {
  const session: AuthSessionResponse = {
    accessToken: 'header.payload.signature',
    expiresIn: 900,
    user: {
      id: '0192f4b1-0000-7000-8000-000000000001',
      email: 'admin@example.test',
      role: 'ORG_ADMIN',
      organization: null,
      mustChangePassword: false,
      permissions: [],
    },
  };

  function fakeServer(handler: (config: InternalAxiosRequestConfig) => AxiosResponse) {
    const calls: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = async (config) => {
      calls.push(config);
      const response = handler(config);
      if (response.status >= 400) {
        throw new AxiosError('failed', undefined, config, undefined, response);
      }
      return response;
    };
    return calls;
  }

  const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
    ({ status, data, statusText: '', headers: {}, config }) satisfies AxiosResponse;

  afterEach(() => {
    setSession(null);
    apiClient.defaults.adapter = undefined;
  });

  it('sends one refresh request no matter how many callers ask at once', async () => {
    // A reused refresh token revokes the session, so duplicates must never be sent.
    const calls = fakeServer((config) => reply(config, 200, session));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('refreshes an expired access token and replays the request', async () => {
    setSession({ ...session, accessToken: 'old.access.token' });
    const calls = fakeServer((config) => {
      if (config.url === '/auth/refresh') return reply(config, 200, session);
      const auth = config.headers.get('Authorization');
      return auth === `Bearer ${session.accessToken}`
        ? reply(config, 200, { ok: true })
        : reply(config, 401, { error: { code: 'TOKEN_INVALID', message: 'expired' } });
    });

    const { data } = await apiClient.get('/audit-logs');
    expect(data).toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual(['/audit-logs', '/auth/refresh', '/audit-logs']);
  });

  it('clears the session when the refresh token is rejected', async () => {
    const seen: unknown[] = [];
    const unsubscribe = onSessionChange((value) => seen.push(value));
    fakeServer((config) =>
      reply(config, 401, { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } }),
    );
    await expect(refreshSession()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(seen).toEqual([null]);
    unsubscribe();
  });
});
