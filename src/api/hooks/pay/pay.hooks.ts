import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    USER_ROUTES,
    GetUserPaymentsCommand,
    GetPaysystemsCommand,
    GetPaymentForecastCommand,
    DeleteAutopaymentCommand,
    GetUserWithdrawalsCommand
} from '@bkeenke/shm-contract';

export const payKeys = {
  all: ['pay'] as const,
  payments: (params?: { limit?: number; offset?: number }) => [...payKeys.all, 'payments', params] as const,
  withdrawals: (params?: { limit?: number; offset?: number }) => [...payKeys.all, 'withdrawals', params] as const,
  paySystems: () => [...payKeys.all, 'paySystems'] as const,
  forecast: () => [...payKeys.all, 'forecast'] as const,
};

// ============ Get Payments ============
export const usePayments = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: payKeys.payments(params),
    queryFn: async () => {
      const response = await api.get<{ data: GetUserPaymentsCommand.Response; items?: number }>(
        USER_ROUTES.PAY,
        { params }
      );
      return {
        payments: Array.isArray(response.data.data) ? response.data.data : [response.data.data],
        totalItems: response.data.items ?? 0,
      };
    },
  });
};

// ============ Get Pay Systems ============
export const usePaySystems = () => {
  return useQuery({
    queryKey: payKeys.paySystems(),
    queryFn: async () => {
      const response = await api.get<{ data: GetPaysystemsCommand.Response }>(USER_ROUTES.PAY_PAYSYSTEMS);
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Get Payment Forecast ============
export const usePaymentForecast = () => {
  return useQuery({
    queryKey: payKeys.forecast(),
    queryFn: async () => {
      const response = await api.get<{ data: GetPaymentForecastCommand.Response }>(USER_ROUTES.PAY_FORECAST);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

// ============ Delete Autopayment ============
export const useDeleteAutopayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paySystem: string) => {
      const response = await api.delete<{ data: DeleteAutopaymentCommand.Response }>(
        USER_ROUTES.AUTOPAYMENT,
        { params: { pay_system: paySystem } satisfies DeleteAutopaymentCommand.Request }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payKeys.all });
    },
  });
};

// ============ Get Withdrawals ============
export const useWithdrawals = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: payKeys.withdrawals(params),
    queryFn: async () => {
      const response = await api.get<{ data: GetUserWithdrawalsCommand.Response; items?: number }>(
        USER_ROUTES.WITHDRAW,
        { params }
      );
      return {
        withdrawals: Array.isArray(response.data.data) ? response.data.data : [response.data.data],
        totalItems: response.data.items ?? 0,
      };
    },
  });
};
