import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import { setCookie } from '../../cookie';
import {
    USER_ROUTES,
    PasskeyListCommand,
    PasskeyRenameCommand,
    PasskeyDeleteCommand,
    PasskeyRegisterOptionsCommand,
    PasskeyRegisterCompleteCommand,
    PasskeyAuthOptionsCommand,
    PasskeyAuthCommand
} from '@bkeenke/shm-contract';

export const passkeyKeys = {
  all: ['passkey'] as const,
  list: () => [...passkeyKeys.all, 'list'] as const,
  registerOptions: () => [...passkeyKeys.all, 'registerOptions'] as const,
  authOptions: () => [...passkeyKeys.all, 'authOptions'] as const,
};

// ============ Passkey List ============
export const usePasskeyList = () => {
  return useQuery({
    queryKey: passkeyKeys.list(),
    queryFn: async () => {
      const response = await api.get<PasskeyListCommand.Response>(USER_ROUTES.PASSKEY.ROOT);
      const data = response.data.data;
      return Array.isArray(data) ? data : [data];
    },
  });
};

// ============ Passkey Rename ============
export const usePasskeyRename = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ credentialId, name }: { credentialId: string; name: string }) => {
      const response = await api.post<PasskeyRenameCommand.Response>(
        USER_ROUTES.PASSKEY.ROOT,
        { credential_id: credentialId, name } satisfies PasskeyRenameCommand.Request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passkeyKeys.list() });
    },
  });
};

// ============ Passkey Delete ============
export const usePasskeyDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await api.delete<PasskeyDeleteCommand.Response>(
        USER_ROUTES.PASSKEY.ROOT,
        { params: { credential_id: credentialId } satisfies PasskeyDeleteCommand.Request }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passkeyKeys.list() });
    },
  });
};

// ============ Passkey Register Options ============
export const usePasskeyRegisterOptions = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<PasskeyRegisterOptionsCommand.Response>(USER_ROUTES.PASSKEY.REGISTER);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

// ============ Passkey Register Complete ============
export const usePasskeyRegisterComplete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PasskeyRegisterCompleteCommand.Request) => {
      const response = await api.post<PasskeyRegisterCompleteCommand.Response>(
        USER_ROUTES.PASSKEY.REGISTER,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passkeyKeys.list() });
    },
  });
};

// ============ Passkey Auth Options (Public) ============
export const usePasskeyAuthOptions = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<PasskeyAuthOptionsCommand.Response>(USER_ROUTES.PASSKEY.AUTH);
      const data = response.data.data;
      return Array.isArray(data) ? data[0] : data;
    },
  });
};

// ============ Passkey Auth (Public) ============
export const usePasskeyAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PasskeyAuthCommand.Request) => {
      const response = await api.post<PasskeyAuthCommand.Response>(
        USER_ROUTES.PASSKEY.AUTH,
        data
      );
      const authData = response.data.data;
      const sessionData = Array.isArray(authData) ? authData[0] : authData;

      if (sessionData?.id) {
        setCookie(sessionData.id);
      }

      return sessionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
    },
  });
};
