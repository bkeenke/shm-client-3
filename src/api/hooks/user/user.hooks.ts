import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    USER_ROUTES,
    GetCurrentUserCommand,
    UpdateCurrentUserCommand,
    ChangePasswordCommand,
    PasswordResetRequestCommand,
    PasswordResetVerifyCommand,
    PasswordResetConfirmCommand,
    SetEmailCommand,
    VerifyEmailCommand
} from '@bkeenke/shm-contract';

export const userKeys = {
  all: ['user'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
};

export const useProfile = () => {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: async () => {
      const response = await api.get<{ data: GetCurrentUserCommand.Response }>(USER_ROUTES.ROOT);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCurrentUserCommand.Request) => {
      const response = await api.post<{ data: UpdateCurrentUserCommand.Response }>(
        USER_ROUTES.ROOT,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (password: string) => {
      const response = await api.post<{ data: ChangePasswordCommand.Response }>(
        USER_ROUTES.PASSWD,
        { password } satisfies ChangePasswordCommand.Request
      );
      return response.data;
    },
  });
};

export const useResetPasswordRequest = () => {
  return useMutation({
    mutationFn: async (params: PasswordResetRequestCommand.Request) => {
      const response = await api.post<{ data: PasswordResetRequestCommand.Response }>(
        USER_ROUTES.PASSWD_RESET,
        params
      );
      return response.data;
    },
  });
};

export const useVerifyResetToken = (token: string | null) => {
  return useQuery({
    queryKey: ['user', 'resetToken', token],
    queryFn: async () => {
      const response = await api.get<{ data: PasswordResetVerifyCommand.Response }>(
        USER_ROUTES.PASSWD_RESET_VERIFY,
        { params: { token } satisfies PasswordResetVerifyCommand.Request }
      );
      const data = response.data?.data as { msg?: string } | Array<{ msg?: string }>;
      const msg = Array.isArray(data) ? data[0]?.msg : data?.msg;
      return { isValid: msg === 'Successful', msg };
    },
    enabled: !!token,
  });
};

export const useResetPasswordWithToken = () => {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const response = await api.post<{ data: PasswordResetConfirmCommand.Response }>(
        USER_ROUTES.PASSWD_RESET_VERIFY,
        { token, password } satisfies PasswordResetConfirmCommand.Request
      );
      return response.data;
    },
  });
};

export const useSetEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.put<{ data: SetEmailCommand.Response }>(
        USER_ROUTES.EMAIL_SET,
        { email } satisfies SetEmailCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },
  });
};

export const useSendVerifyCode = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post<{ data: VerifyEmailCommand.Response }>(
        USER_ROUTES.EMAIL_VERIFY,
        { email } satisfies VerifyEmailCommand.Request
      );
      return response.data;
    },
  });
};

export const useConfirmEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post<{ data: VerifyEmailCommand.Response }>(
        USER_ROUTES.EMAIL_VERIFY,
        { code } satisfies VerifyEmailCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },
  });
};
