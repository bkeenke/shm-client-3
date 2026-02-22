import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    USER_ROUTES,
    PasswordAuthStatusCommand,
    EnablePasswordAuthCommand,
    DisablePasswordAuthCommand
} from '@bkeenke/shm-contract';

export const passwordAuthKeys = {
  all: ['passwordAuth'] as const,
  status: () => [...passwordAuthKeys.all, 'status'] as const,
};

// ============ Password Auth Status ============
export const usePasswordAuthStatus = () => {
  return useQuery({
    queryKey: passwordAuthKeys.status(),
    queryFn: async () => {
      const response = await api.get<PasswordAuthStatusCommand.Response>(USER_ROUTES.PASSWORD_AUTH);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

// ============ Enable Password Auth ============
export const useEnablePasswordAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<EnablePasswordAuthCommand.Response>(USER_ROUTES.PASSWORD_AUTH);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passwordAuthKeys.status() });
    },
  });
};

// ============ Disable Password Auth ============
export const useDisablePasswordAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete<DisablePasswordAuthCommand.Response>(USER_ROUTES.PASSWORD_AUTH);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passwordAuthKeys.status() });
    },
  });
};
