import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './client';

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
