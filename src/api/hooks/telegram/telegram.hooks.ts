import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    TELEGRAM_ROUTES,
    GetTelegramUserSettingsCommand,
    UpdateTelegramUserSettingsCommand
} from '@bkeenke/shm-contract';

export const telegramKeys = {
  all: ['telegram'] as const,
  settings: () => [...telegramKeys.all, 'settings'] as const,
};

export const useTelegramSettings = () => {
  return useQuery({
    queryKey: telegramKeys.settings(),
    queryFn: async () => {
      const response = await api.get<{ data: GetTelegramUserSettingsCommand.Response }>(TELEGRAM_ROUTES.USER);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

export const useUpdateTelegramSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTelegramUserSettingsCommand.Request) => {
      const response = await api.post<{ data: UpdateTelegramUserSettingsCommand.Response }>(
        TELEGRAM_ROUTES.USER,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telegramKeys.settings() });
    },
  });
};