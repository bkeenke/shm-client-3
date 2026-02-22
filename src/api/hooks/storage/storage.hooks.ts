import { useQuery } from '@tanstack/react-query';
import { api } from '../../client';
import {
    STORAGE_ROUTES,
    GetStorageItemsCommand
} from '@bkeenke/shm-contract';

export const storageKeys = {
  all: ['storage'] as const,
  list: () => [...storageKeys.all, 'list'] as const,
  item: (name: string, format?: string) => [...storageKeys.all, 'item', name, format] as const,
};

// ============ Get Storage Items List ============
export const useStorageList = () => {
  return useQuery({
    queryKey: storageKeys.list(),
    queryFn: async () => {
      const response = await api.get<{ data: GetStorageItemsCommand.Response }>(STORAGE_ROUTES.MANAGE);
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Get Storage Item ============
export const useStorageItem = (name: string, options?: { enabled?: boolean; format?: 'json' | 'raw' }) => {
  const { enabled = true, format } = options ?? {};

  return useQuery({
    queryKey: storageKeys.item(name, format),
    queryFn: async () => {
      const url = format === 'json'
        ? `${STORAGE_ROUTES.MANAGE_ITEM(name)}?format=json`
        : STORAGE_ROUTES.MANAGE_ITEM(name);
      const response = await api.get(url);

      // For JSON format, return parsed data with subscription_url
      if (format === 'json') {
        const subscriptionUrl = response.data?.subscription_url || response.data?.response?.subscriptionUrl;
        return { subscriptionUrl, raw: response.data };
      }

      // For raw format (VPN configs), return as string
      return { raw: response.data };
    },
    enabled: enabled && !!name,
  });
};
