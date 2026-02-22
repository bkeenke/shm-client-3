import { useState } from 'react';
import { Card, Text, Stack, Group, Button, TextInput, Badge, Loader, Box, Modal, Code, ActionIcon, SimpleGrid } from '@mantine/core';
import { IconShieldLock, IconCheck, IconCopy, IconQrcode } from '@tabler/icons-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useOtpStatus, useOtpSetup, useOtpEnable, useOtpDisable } from '../../api/hooks/otp/otp.hooks';
import type { OtpSetupCommand } from '@bkeenke/shm-contract';
import QrModal from '../QrModal';
import { config } from '../../config';

interface OtpSettingsProps {
  embedded?: boolean;
}

type OtpSetupData = OtpSetupCommand.Response;

export default function OtpSettings({ embedded = false }: OtpSettingsProps) {
  const { t } = useTranslation();

  // Data hooks
  const { data: status, isLoading: loading, refetch: refetchStatus } = useOtpStatus();
  const otpSetup = useOtpSetup();
  const otpEnable = useOtpEnable();
  const otpDisable = useOtpDisable();

  // UI state
  const [setupData, setSetupData] = useState<OtpSetupData | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [token, setToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const { copied: secretCopied, copy: copySecret } = useCopyToClipboard();
  const { copied: backupCopied, copy: copyBackup } = useCopyToClipboard();

  const handleSetup = () => {
    otpSetup.mutate(undefined, {
      onSuccess: (data) => {
        setSetupData(data);
        setSetupModalOpen(true);
        setToken('');
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('otp.setupError')),
          color: 'red',
        });
      },
    });
  };

  const handleEnable = () => {
    if (!token || token.length !== 6) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('otp.enterValidCode')),
        color: 'red',
      });
      return;
    }

    otpEnable.mutate(token, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('otp.enableSuccess')),
          color: 'green',
        });
        setShowBackupCodes(true);
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

  const handleCloseSetup = () => {
    setSetupModalOpen(false);
    setSetupData(null);
    setToken('');
    setShowBackupCodes(false);
    refetchStatus();
  };

  const handleDisable = () => {
    if (!disableToken) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('otp.enterCodeOrBackup')),
        color: 'red',
      });
      return;
    }

    otpDisable.mutate(disableToken, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('otp.disableSuccess')),
          color: 'green',
        });
        setDisableModalOpen(false);
        setDisableToken('');
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

  if (config.OTP_ENABLE !== 'true') {
    return null;
  }

  if (loading) {
    if (embedded) {
      return (
        <Stack gap="xs">
          <Group gap="xs">
            <IconShieldLock size={18} />
            <Text fw={500}>{t('otp.title')}</Text>
          </Group>
          <Loader size="sm" />
        </Stack>
      );
    }
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" py="md">
          <Loader size="sm" />
        </Stack>
      </Card>
    );
  }

  const mainContent = (
    <Stack gap={embedded ? "xs" : "md"}>
      <Group justify="space-between">
        <Group gap="xs">
          <IconShieldLock size={embedded ? 18 : 24} />
          <Text fw={500}>{t('otp.title')}</Text>
        </Group>
        {status?.enabled && (
          <Badge color="green" variant="light">
            {t('otp.enabled')}
          </Badge>
        )}
      </Group>

      <Text size="sm" c="dimmed">
        {t('otp.description')}
      </Text>

      {status?.enabled ? (
        <Button
          variant="light"
          color="red"
          onClick={() => setDisableModalOpen(true)}
        >
          {t('otp.disable')}
        </Button>
      ) : (
        <Button
          variant="light"
          color="blue"
          onClick={handleSetup}
        >
          {t('otp.enable')}
        </Button>
      )}
    </Stack>
  );

  return (
    <>
      {embedded ? (
        mainContent
      ) : (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          {mainContent}
        </Card>
      )}

      <Modal
        opened={setupModalOpen}
        onClose={handleCloseSetup}
        title={t('otp.setupTitle')}
        size="md"
      >
        {setupData && !showBackupCodes && (
          <Stack gap="md">
            <Text size="sm">{t('otp.setupInstructions')}</Text>

            <Box
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
              }}
            >
              <Button
                variant="light"
                leftSection={<IconQrcode size={18} />}
                onClick={() => setQrModalOpen(true)}
              >
                {t('otp.showQrCode')}
              </Button>
            </Box>

            <Text size="sm" ta="center" c="dimmed">
              {t('otp.orEnterManually')}
            </Text>

            <Group gap="xs" justify="center">
              <Code style={{ fontSize: '14px', padding: '8px 12px' }}>
                {setupData.secret}
              </Code>
              <ActionIcon
                color={secretCopied ? 'green' : 'gray'}
                variant="subtle"
                onClick={() => copySecret(setupData.secret)}
              >
                {secretCopied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Group>

            <TextInput
              label={t('otp.enterCode')}
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              style={{ textAlign: 'center' }}
            />

            <Button
              onClick={handleEnable}
              loading={otpEnable.isPending}
              disabled={token.length !== 6}
            >
              {t('otp.confirmEnable')}
            </Button>
          </Stack>
        )}

        {setupData && showBackupCodes && (
          <Stack gap="md">
            <Text size="sm" fw={500} c="green">
              {t('otp.enabledSuccessfully')}
            </Text>

            <Text size="sm">{t('otp.backupCodesDescription')}</Text>

            <Card withBorder p="md">
              <SimpleGrid cols={2} spacing="xs">
                {setupData.backup_codes.map((code: string | number, index: number) => (
                  <Code key={index} style={{ textAlign: 'center', padding: '4px' }}>
                    {code}
                  </Code>
                ))}
              </SimpleGrid>
            </Card>

            <Button
              variant="light"
              color={backupCopied ? 'green' : 'gray'}
              leftSection={backupCopied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={() => copyBackup(setupData.backup_codes.join('\n'))}
            >
              {backupCopied ? t('common.copied') : t('otp.copyBackupCodes')}
            </Button>

            <Text size="xs" c="red">
              {t('otp.backupCodesWarning')}
            </Text>

            <Button onClick={handleCloseSetup}>
              {t('common.close')}
            </Button>
          </Stack>
        )}
      </Modal>

      {setupData && (
        <QrModal
          opened={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          data={setupData.qr_url}
          title={t('otp.scanQrCode')}
        />
      )}

      <Modal
        opened={disableModalOpen}
        onClose={() => {
          setDisableModalOpen(false);
          setDisableToken('');
        }}
        title={t('otp.disableTitle')}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{t('otp.disableConfirm')}</Text>

          <TextInput
            label={t('otp.enterCodeOrBackup')}
            placeholder={t('otp.codePlaceholder')}
            value={disableToken}
            onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                setDisableModalOpen(false);
                setDisableToken('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              color="red"
              onClick={handleDisable}
              loading={otpDisable.isPending}
              disabled={!disableToken}
            >
              {t('otp.disable')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
