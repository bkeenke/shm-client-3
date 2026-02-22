import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    SERVICE_ROUTES,
    USER_ROUTES,
    GetServicesForOrderCommand,
    GetUserServicesCommand,
    OrderServiceCommand,
    StopUserServiceCommand,
    ChangeUserServiceCommand
} from '@bkeenke/shm-contract';

export const servicesKeys = {
  all: ['services'] as const,
  list: () => [...servicesKeys.all, 'list'] as const,
  orderList: (filter?: { category?: string; service_id?: number | string }) => [...servicesKeys.all, 'orderList', filter] as const,
  userServices: () => [...servicesKeys.all, 'userServices'] as const,
};

// ============ Get Services List ============
export const useServicesList = () => {
  return useQuery({
    queryKey: servicesKeys.list(),
    queryFn: async () => {
      const response = await api.get(SERVICE_ROUTES.ROOT);
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Get Services For Order ============
export const useServicesOrderList = (filter?: { category?: string; service_id?: number | string }) => {
  return useQuery({
    queryKey: servicesKeys.orderList(filter),
    queryFn: async () => {
      const response = await api.get<{ data: GetServicesForOrderCommand.Response }>(SERVICE_ROUTES.ORDER, {
        params: filter ? { filter: JSON.stringify(filter) } : {},
      });
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Get User Services ============
export const useUserServices = () => {
  return useQuery({
    queryKey: servicesKeys.userServices(),
    queryFn: async () => {
      const response = await api.get<{ data: GetUserServicesCommand.Response }>(USER_ROUTES.SERVICE, {
        params: { limit: 1000 },
      });
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Order Service ============
export const useOrderService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: number) => {
      const response = await api.put<{ data: OrderServiceCommand.Response }>(
        SERVICE_ROUTES.ORDER,
        { service_id: serviceId } satisfies OrderServiceCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKeys.userServices() });
    },
  });
};

// ============ Stop User Service ============
export const useStopService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userServiceId: number) => {
      const response = await api.post<{ data: StopUserServiceCommand.Response }>(
        USER_ROUTES.SERVICE_STOP,
        { user_service_id: userServiceId } satisfies StopUserServiceCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKeys.userServices() });
    },
  });
};

// ============ Change User Service ============
export const useChangeService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userServiceId,
      serviceId,
      finishActive,
    }: {
      userServiceId: number;
      serviceId: number;
      finishActive: number;
    }) => {
      const response = await api.post<{ data: ChangeUserServiceCommand.Response }>(
        USER_ROUTES.SERVICE_CHANGE,
        { user_service_id: userServiceId, service_id: serviceId, finish_active: finishActive } as ChangeUserServiceCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKeys.userServices() });
    },
  });
};

// ============ Delete User Service ============
export const useDeleteService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userServiceId: number) => {
      const response = await api.delete(
        USER_ROUTES.SERVICE,
        { params: { user_service_id: userServiceId } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKeys.userServices() });
    },
  });
};
