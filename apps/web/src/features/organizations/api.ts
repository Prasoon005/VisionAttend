import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrganizationResponseSchema,
  organizationListResponseSchema,
  organizationSchema,
  type CreateOrganizationRequest,
  type UpdateOrganizationRequest,
} from '@visionattend/shared';
import { apiClient, toApiError } from '../../lib/api/client';

const KEY = ['platform', 'organizations'] as const;

export const useOrganizations = (page: number) =>
  useQuery({
    queryKey: [...KEY, page],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<unknown>('/platform/organizations', {
          params: { page, pageSize: 20 },
        });
        return organizationListResponseSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
  });

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateOrganizationRequest) => {
      try {
        const { data } = await apiClient.post<unknown>('/platform/organizations', body);
        return createOrganizationResponseSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateOrganizationRequest & { id: string }) => {
      try {
        const { data } = await apiClient.patch<unknown>(`/platform/organizations/${id}`, body);
        return organizationSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
