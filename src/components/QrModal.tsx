import { Modal, Stack, Center, Text, Button, Group, Tooltip, ActionIcon, Alert } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconCopy, IconCheck, IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import { useClipboard } from '@mantine/hooks';
import { useMemo } from 'react';

const MAX_QR_DATA_LENGTH = 2900;

interface QrModalProps {
  opened: boolean;
  onClose: () => void;
  data: string;
  title?: string;
  filename?: string;
  onDownload?: () => void;
}

export default function QrModal({ opened, onClose, data, title, filename, onDownload }: QrModalProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 1000 });

  const isDataTooLong = useMemo(() => {
    return data ? data.length > MAX_QR_DATA_LENGTH : false;
  }, [data]);

  const handleDownloadQr = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename ? `${filename}.png` : 'qrcode.png';
      a.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (!data) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={title || t('services.qrCode')} size="md">
      <Stack gap="md" align="center">
        {isDataTooLong ? (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" title={t('services.qrTooLong')}>
            {t('services.qrTooLongDesc')}
          </Alert>
        ) : (
          <Center p="md" bg="white" style={{ borderRadius: 8 }}>
            <QRCodeSVG
              id="qr-code-svg"
              value={data}
              size={256}
              level="L"
              includeMargin
            />
          </Center>
        )}

        <Group>
          {onDownload && (
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={onDownload}
            >
              {t('services.downloadConfig')}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
