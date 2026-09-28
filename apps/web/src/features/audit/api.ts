import { useQuery } from '@tanstack/react-query';
import { auditLogListResponseSchema } from '@visionattend/shared';
import { apiClient, toApiError } from '../../lib/api/client';

export const useAuditLogs = (page: number, pageSize = 10) =>
  useQuery({
    queryKey: ['audit-logs', page, pageSize],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<unknown>('/audit-logs', {
          params: { page, pageSize },
        });
        return auditLogListResponseSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
  });
