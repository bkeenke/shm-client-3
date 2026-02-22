import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    PROMO_ROUTES,
    GetUsedPromosCommand,
    ApplyPromoCommand
} from '@bkeenke/shm-contract';

export const promoKeys = {
  all: ['promo'] as const,
  list: () => [...promoKeys.all, 'list'] as const,
};

// ============ Get Used Promos ============
export const usePromoList = () => {
  return useQuery({
    queryKey: promoKeys.list(),
    queryFn: async () => {
      const response = await api.get<{ data: GetUsedPromosCommand.Response }>(PROMO_ROUTES.ROOT);
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Apply Promo ============
export const useApplyPromo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const response = await api.get<{ data: ApplyPromoCommand.Response }>(PROMO_ROUTES.APPLY(code));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promoKeys.list() });
    },
  });
};
