import { useQuery } from '@tanstack/react-query';
import {
  livenessResponseSchema,
  readinessResponseSchema,
  type LivenessResponse,
  type ReadinessResponse,
} from '@visionattend/shared';
import { apiClient, toApiError } from '../../lib/api/client';

async function fetchLiveness(): Promise<LivenessResponse> {
  try {
    const { data } = await apiClient.get<unknown>('/health');
    return livenessResponseSchema.parse(data);
  } catch (error) {
    throw toApiError(error);
  }
}

async function fetchReadiness(): Promise<ReadinessResponse> {
  try {
    // 503 is a valid answer ("degraded"), not a failure of the request.
    const { data } = await apiClient.get<unknown>('/health/ready', {
      validateStatus: (status) => status === 200 || status === 503,
    });
    return readinessResponseSchema.parse(data);
  } catch (error) {
    throw toApiError(error);
  }
}

const REFRESH_MS = 10_000;

export const useLiveness = () =>
  useQuery({
    queryKey: ['health', 'liveness'],
    queryFn: fetchLiveness,
    refetchInterval: REFRESH_MS,
  });

export const useReadiness = () =>
  useQuery({
    queryKey: ['health', 'readiness'],
    queryFn: fetchReadiness,
    refetchInterval: REFRESH_MS,
  });
