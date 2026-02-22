import { useState } from 'react';
import { Card, Text, Stack, Group, Button, TextInput, ActionIcon, Loader, Box, Modal } from '@mantine/core';
import { IconFingerprint, IconTrash, IconEdit, IconPlus, IconDeviceMobile } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { usePasskeyList, usePasskeyRename, usePasskeyDelete, usePasskeyRegisterOptions, usePasskeyRegisterComplete } from '../../api/hooks/passkey/passkey.hooks';
import type { PasskeyListCommand } from '@bkeenke/shm-contract';
import ConfirmModal from '../ConfirmModal';
import { config } from '../../config';

type PasskeyCredential = PasskeyListCommand.Response['credentials'][number];

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface PasskeySettingsProps {
  embedded?: boolean;
}

export default function PasskeySettings({ embedded = false }: PasskeySettingsProps) {
  const { t } = useTranslation();
  const isWebAuthnSupported = !!window.PublicKeyCredential;

  // Data hooks
  const { data: passkeyData, isLoading: loading, refetch: refetchCredentials } = usePasskeyList();
  const passkeyRename = usePasskeyRename();
  const passkeyDelete = usePasskeyDelete();
  const registerOptions = usePasskeyRegisterOptions();
  const registerComplete = usePasskeyRegisterComplete();

  const credentials = passkeyData?.[0]?.credentials || [];

  // UI state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<PasskeyCredential | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [credentialToRename, setCredentialToRename] = useState<PasskeyCredential | null>(null);
  const [newName, setNewName] = useState('');
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);

  const handleRegister = async () => {
    if (!isWebAuthnSupported) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('passkey.notSupported')),
        color: 'red',
      });
      return;
    }

    setRegistering(true);
    try {
      const options = await registerOptions.mutateAsync();
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64UrlToArrayBuffer(options.challenge),
        rp: {
          name: options.rp.name,
          id: options.rp.id,
        },
        user: {
          id: base64UrlToArrayBuffer(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams.map((p: { type: string; alg: number }) => ({
          type: p.type as PublicKeyCredentialType,
          alg: p.alg,
        })),
        timeout: options.timeout,
        attestation: options.attestation as AttestationConveyancePreference,
        excludeCredentials: (options.excludeCredentials || []).map((c: { id: string; type: string }) => ({
          id: base64UrlToArrayBuffer(c.id),
          type: c.type as PublicKeyCredentialType,
        })),
        authenticatorSelection: {
          authenticatorAttachment: options.authenticatorSelection.authenticatorAttachment as AuthenticatorAttachment,
          residentKey: options.authenticatorSelection.residentKey as ResidentKeyRequirement,
          userVerification: options.authenticatorSelection.userVerification as UserVerificationRequirement,
        },
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      await registerComplete.mutateAsync({
        credential_id: arrayBufferToBase64Url(credential.rawId),
        rawId: arrayBufferToBase64Url(credential.rawId),
        response: {
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          attestationObject: arrayBufferToBase64Url(response.attestationObject),
        },
      });

      notifications.show({
        title: String(t('common.success')),
        message: String(t('passkey.registerSuccess')),
        color: 'green',
      });
      refetchCredentials();
    } catch (error: unknown) {
      console.error('Passkey registration error:', error);

      let errorMessage = String(t('passkey.registerError'));
      const err = error as { name?: string };
      if (err?.name === 'InvalidStateError') {
        errorMessage = String(t('passkey.alreadyRegistered'));
      } else if (err?.name === 'NotAllowedError') {
        errorMessage = String(t('passkey.cancelled'));
      }

      notifications.show({
        title: String(t('common.error')),
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setRegistering(false);
    }
  };

  const openDeleteModal = (credential: PasskeyCredential) => {
    setCredentialToDelete(credential);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (!credentialToDelete) return;

    passkeyDelete.mutate(credentialToDelete.id, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('passkey.deleteSuccess')),
          color: 'green',
        });
        setDeleteModalOpen(false);
        setCredentialToDelete(null);
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('passkey.deleteError')),
          color: 'red',
        });
      },
    });
  };

  const openRenameModal = (credential: PasskeyCredential) => {
    setCredentialToRename(credential);
    setNewName(credential.name);
    setRenameModalOpen(true);
  };

  const handleRename = () => {
    if (!credentialToRename || !newName.trim()) return;

    passkeyRename.mutate(
      { credentialId: credentialToRename.id, name: newName.trim() },
      {
        onSuccess: () => {
          notifications.show({
            title: String(t('common.success')),
            message: String(t('passkey.renameSuccess')),
            color: 'green',
          });
          setRenameModalOpen(false);
          setCredentialToRename(null);
          setNewName('');
        },
        onError: () => {
          notifications.show({
            title: String(t('common.error')),
            message: String(t('passkey.renameError')),
            color: 'red',
          });
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (config.PASSKEY_ENABLE !== 'true') {
    return null;
  }

  if (!isWebAuthnSupported) {
    const content = (
      <>
        <Group gap="xs" mb={embedded ? "xs" : "md"}>
          <IconFingerprint size={embedded ? 18 : 24} />
          <Text fw={500}>{t('passkey.title')}</Text>
        </Group>
        <Text size="sm" c="dimmed">
          {t('passkey.notSupported')}
        </Text>
      </>
    );

    if (embedded) {
      return <Stack gap="xs">{content}</Stack>;
    }

    return (
      <Card withBorder radius="md" p="lg">
        {content}
      </Card>
    );
  }

  if (loading) {
    const content = (
      <>
        <Group gap="xs" mb={embedded ? "xs" : "md"}>
          <IconFingerprint size={embedded ? 18 : 24} />
          <Text fw={500}>{t('passkey.title')}</Text>
        </Group>
        <Loader size="sm" />
      </>
    );

    if (embedded) {
      return <Stack gap="xs">{content}</Stack>;
    }

    return (
      <Card withBorder radius="md" p="lg">
        {content}
      </Card>
    );
  }

  const fullManagementContent = (
    <>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconFingerprint size={18} />
          <Text fw={500}>{t('passkey.title')}</Text>
        </Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={handleRegister}
          loading={registering}
        >
          {t('passkey.add')}
        </Button>
      </Group>

      {credentials.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('passkey.noPasskeys')}
        </Text>
      ) : (
        <Stack gap="sm">
          {(credentials as PasskeyCredential[]).map((credential) => (
            <Box
              key={credential.id}
              p="sm"
              style={(theme) => ({
                border: `1px solid ${theme.colors.gray[3]}`,
                borderRadius: theme.radius.sm,
              })}
            >
              <Group justify="space-between">
                <Group>
                  <IconDeviceMobile size={20} />
                  <div>
                    <Text size="sm" fw={500}>{credential.name}</Text>
                    <Text size="xs" c="dimmed">
                      {t('passkey.createdAt')}: {formatDate(credential.created_at)}
                    </Text>
                  </div>
                </Group>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => openRenameModal(credential)}
                    title={t('passkey.rename')}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => openDeleteModal(credential)}
                    title={t('common.delete')}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Box>
          ))}
        </Stack>
      )}

      <Text size="xs" c="dimmed" mt="md">
        {t('passkey.description')}
      </Text>
    </>
  );

  const summaryContent = (
    <Stack gap="xs">
      <Group justify="space-between">
        <Group gap="xs">
          <IconFingerprint size={18} />
          <Text fw={500}>{t('passkey.title')}</Text>
        </Group>
        <Button
          variant="light"
          size="xs"
          onClick={() => setManageModalOpen(true)}
        >
          {t('passkey.manage')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {credentials.length === 0
          ? t('passkey.noPasskeys')
          : t('passkey.devicesCount', { count: credentials.length })}
      </Text>
    </Stack>
  );

  return (
    <>
      {embedded ? (
        summaryContent
      ) : (
        <Card withBorder radius="md" p="lg">{fullManagementContent}</Card>
      )}

      <Modal
        opened={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        title={t('passkey.title')}
        size="md"
      >
        {fullManagementContent}
      </Modal>

      <ConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('passkey.deleteTitle')}
        message={t('passkey.deleteConfirm', { name: credentialToDelete?.name || '' })}
        confirmLabel={t('common.delete')}
        confirmColor="red"
        loading={passkeyDelete.isPending}
      />

      <Modal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title={t('passkey.renameTitle')}
      >
        <Stack gap="md">
          <TextInput
            label={t('passkey.name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setRenameModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRename} loading={passkeyRename.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
