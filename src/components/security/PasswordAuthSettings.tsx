import { useState } from 'react';
import { Card, Text, Stack, Group, Button, Badge, Alert, Divider } from '@mantine/core';
import { IconLock, IconLockOpen, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { usePasswordAuthStatus, useEnablePasswordAuth, useDisablePasswordAuth } from '../../api/hooks/pass-auth/pass-auth.hooks';
import ConfirmModal from '../ConfirmModal';

interface PasswordAuthSettingsProps {
  embedded?: boolean;
}

export default function PasswordAuthSettings({ embedded = false }: PasswordAuthSettingsProps) {
  const { t } = useTranslation();

  // Data hooks
  const { data: status, isLoading: loading } = usePasswordAuthStatus();
  const enablePasswordAuth = useEnablePasswordAuth();
  const disablePasswordAuth = useDisablePasswordAuth();

  // UI state
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);

  const handleDisable = () => {
    disablePasswordAuth.mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('passwordAuth.disableSuccess')),
          color: 'green',
        });
        setConfirmDisableOpen(false);
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('passwordAuth.disableError')),
          color: 'red',
        });
      },
    });
  };

  const handleEnable = () => {
    enablePasswordAuth.mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('passwordAuth.enableSuccess')),
          color: 'green',
        });
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('passwordAuth.enableError')),
          color: 'red',
        });
      },
    });
  };

  if (loading || !status) {
    return null;
  }

  if (!status.passkey_enabled) {
    return null;
  }

  const isDisabled = status.password_auth_disabled === 1;

  const mainContent = (
    <Stack gap="xs">
      <Group justify="space-between">
        <Group gap="xs">
          {isDisabled ? <IconLock size={embedded ? 18 : 20} /> : <IconLockOpen size={embedded ? 18 : 20} />}
          <Text fw={500}>{t('passwordAuth.title')}</Text>
        </Group>
        <Badge color={isDisabled ? 'green' : 'yellow'}>
          {isDisabled ? t('passwordAuth.disabled') : t('passwordAuth.enabled')}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed">
        {t('passwordAuth.description')}
      </Text>

      {isDisabled ? (
        <>
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            {t('passwordAuth.disabledInfo')}
          </Alert>
          <Button
            variant="light"
            color="green"
            leftSection={<IconLockOpen size={16} />}
            onClick={handleEnable}
            loading={enablePasswordAuth.isPending}
          >
            {t('passwordAuth.enable')}
          </Button>
        </>
      ) : (
        <Button
          variant="light"
          color="red"
          leftSection={<IconLock size={16} />}
          onClick={() => setConfirmDisableOpen(true)}
        >
          {t('passwordAuth.disable')}
        </Button>
      )}
    </Stack>
  );

  return (
    <>
      {embedded ? (
        <>
          <Divider />
          {mainContent}
        </>
      ) : (
        <Card withBorder radius="md" p="lg">
          {mainContent}
        </Card>
      )}

      <ConfirmModal
        opened={confirmDisableOpen}
        onClose={() => setConfirmDisableOpen(false)}
        onConfirm={handleDisable}
        title={t('passwordAuth.disableTitle')}
        message={t('passwordAuth.disableConfirm')}
        confirmLabel={t('passwordAuth.disable')}
        confirmColor="red"
        loading={disablePasswordAuth.isPending}
      />
    </>
  );
}
