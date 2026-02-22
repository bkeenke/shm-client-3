import { useState } from 'react';
import { Modal, Stack, Text, TextInput, Button, Group } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useOtpVerify } from '../../api/hooks/otp/otp.hooks';

interface OtpVerifyModalProps {
  opened: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function OtpVerifyModal({ opened, onClose, onVerified }: OtpVerifyModalProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const otpVerify = useOtpVerify();

  const handleVerify = () => {
    if (!token) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('otp.enterValidCode')),
        color: 'red',
      });
      return;
    }

    otpVerify.mutate(token, {
      onSuccess: () => {
        onVerified();
        setToken('');
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('otp.invalidCode')),
          color: 'red',
        });
      },
    });
  };

  const handleClose = () => {
    setToken('');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconShieldLock size={20} />
          <span>{t('otp.verifyTitle')}</span>
        </Group>
      }
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('otp.verifyDescription')}
        </Text>

        <TextInput
          label={t('otp.enterCode')}
          placeholder="000000"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
          maxLength={8}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          autoFocus
        />

        <Text size="xs" c="dimmed">
          {t('otp.enterCodeOrBackup')}
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="light" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleVerify}
            loading={otpVerify.isPending}
            disabled={!token}
          >
            {t('otp.verify')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
