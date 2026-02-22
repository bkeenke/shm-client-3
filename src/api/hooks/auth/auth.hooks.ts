import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import { getCookie, setCookie, removeCookie, getPartnerCookie, removePartnerCookie } from '../../cookie';
import {
    USER_ROUTES,
    TELEGRAM_ROUTES,
    AuthLoginCommand,
    AuthRegisterCommand,
    TelegramWebAuthCommand,
    TelegramWebappAuthCommand,
    GetCurrentUserCommand
} from '@bkeenke/shm-contract';

export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'currentUser'] as const,
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: AuthLoginCommand.Request): Promise<{ otpRequired: boolean }> => {
      const validatedRequest = AuthLoginCommand.RequestSchema.parse(credentials);

      const response = await api.post<AuthLoginCommand.Response & { otp_required?: boolean }>(
        USER_ROUTES.AUTH,
        validatedRequest
      );

      const result = AuthLoginCommand.ResponseSchema.safeParse(response.data);

      if (!result.success) {
        console.warn('Login response validation warning:', result.error);
      }

      if (response.data.otp_required) {
        return { otpRequired: true };
      }

      if (response.data.id) {
        setCookie(response.data.id);
      }

      return { otpRequired: false };
    },
    onSuccess: (data) => {
      if (!data.otpRequired) {
        queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
      }
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (data: { login: string; password: string }) => {
      const partnerId = getPartnerCookie();
      const requestData = {
        login: data.login,
        password: data.password,
        ...(partnerId && { partner_id: partnerId }),
      };

      const response = await api.put<{ data: AuthRegisterCommand.Response }>(
        USER_ROUTES.ROOT,
        requestData
      );

      if (partnerId) {
        removePartnerCookie();
      }

      return response.data;
    },
  });
};

export const useTelegramWidgetAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: TelegramWebAuthCommand.Request) => {
      const partnerId = getPartnerCookie();

      const response = await api.post<{ data: TelegramWebAuthCommand.Response }>(
        TELEGRAM_ROUTES.WEB_AUTH,
        {
          ...userData,
          register_if_not_exists: 1,
          ...(partnerId && { partner_id: partnerId }),
        }
      );

      const sessionId = response.data.data?.session_id || response.data.data?.id;

      if (sessionId) {
        setCookie(sessionId);
        if (partnerId) {
          removePartnerCookie();
        }
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
  });
};

export const useTelegramWebAppAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TelegramWebappAuthCommand.Request) => {
      const partnerId = getPartnerCookie();

      const params = new URLSearchParams({
        initData: data.initData,
        ...(data.profile && { profile: data.profile }),
        ...(partnerId && { partner_id: partnerId }),
      });

      const response = await api.get<{ data: TelegramWebappAuthCommand.Response }>(
        `${TELEGRAM_ROUTES.WEBAPP_AUTH}?${params.toString()}`
      );

      const sessionId = response.data.data?.session_id || response.data.data?.id;

      if (sessionId) {
        setCookie(sessionId);
        if (partnerId) {
          removePartnerCookie();
        }
      }

      return { sessionId, data: response.data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: async () => {
      const response = await api.get<{ data: GetCurrentUserCommand.Response }>(USER_ROUTES.ROOT);
      const responseData = response.data.data;
      return Array.isArray(responseData) ? responseData[0] : responseData;
    },
    enabled: !!getCookie(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      removeCookie();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/login';
    },
  });
};

export const useAuthState = () => {
  const isAuthenticated = !!getCookie();
  const { data: user, isLoading, error } = useCurrentUser();

  return {
    isAuthenticated,
    user,
    isLoading,
    error,
  };
};
