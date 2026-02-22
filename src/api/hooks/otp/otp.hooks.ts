import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import {
    USER_ROUTES,
    OtpStatusCommand,
    OtpSetupCommand,
    OtpEnableCommand,
    OtpDisableCommand,
    OtpVerifyCommand
} from '@bkeenke/shm-contract';

export const otpKeys = {
  all: ['otp'] as const,
  status: () => [...otpKeys.all, 'status'] as const,
};

export const useOtpStatus = () => {
  return useQuery({
    queryKey: otpKeys.status(),
    queryFn: async () => {
      const response = await api.get<OtpStatusCommand.Response>(USER_ROUTES.OTP.ROOT);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

export const useOtpSetup = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<OtpSetupCommand.Response>(USER_ROUTES.OTP.SETUP);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

export const useOtpEnable = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.put<OtpEnableCommand.Response>(
        USER_ROUTES.OTP.ROOT,
        { token } satisfies OtpEnableCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otpKeys.status() });
    },
  });
};

export const useOtpDisable = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.delete<OtpDisableCommand.Response>(
        USER_ROUTES.OTP.ROOT,
        { params: { token } satisfies OtpDisableCommand.Request }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otpKeys.status() });
    },
  });
};

export const useOtpVerify = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post<OtpVerifyCommand.Response>(
        USER_ROUTES.OTP.ROOT,
        { token } satisfies OtpVerifyCommand.Request
      );
      return response.data;
    },
  });
};
