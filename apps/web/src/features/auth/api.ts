import {
  authSessionResponseSchema,
  authUserSchema,
  type AuthSessionResponse,
  type AuthUser,
  type ChangePasswordRequest,
  type LoginRequest,
} from '@visionattend/shared';
import { apiClient, setSession, toApiError } from '../../lib/api/client';

export async function login(credentials: LoginRequest): Promise<AuthSessionResponse> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/login', credentials, {
      skipAuthRefresh: true,
    });
    const session = authSessionResponseSchema.parse(data);
    setSession(session);
    return session;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function changePassword(body: ChangePasswordRequest): Promise<AuthSessionResponse> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/change-password', body);
    const session = authSessionResponseSchema.parse(data);
    setSession(session);
    return session;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', undefined, { skipAuthRefresh: true });
  } finally {
    // Forget the session locally even if the server could not be reached.
    setSession(null);
  }
}

export async function fetchMe(): Promise<AuthUser> {
  try {
    const { data } = await apiClient.get<unknown>('/auth/me');
    return authUserSchema.parse(data);
  } catch (error) {
    throw toApiError(error);
  }
}
