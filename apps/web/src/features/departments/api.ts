import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  departmentListResponseSchema,
  departmentSchema,
  type CreateDepartmentRequest,
  type UpdateDepartmentRequest,
} from '@visionattend/shared';
import { apiClient, toApiError } from '../../lib/api/client';

const KEY = ['departments'] as const;

export const useDepartments = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<unknown>('/departments');
        return departmentListResponseSchema.parse(data).items;
      } catch (error) {
        throw toApiError(error);
      }
    },
  });

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDepartmentRequest) => {
      try {
        const { data } = await apiClient.post<unknown>('/departments', body);
        return departmentSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateDepartmentRequest & { id: string }) => {
      try {
        const { data } = await apiClient.patch<unknown>(`/departments/${id}`, body);
        return departmentSchema.parse(data);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/departments/${id}`);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
