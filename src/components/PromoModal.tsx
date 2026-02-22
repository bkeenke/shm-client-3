import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Stack, Group, Button, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useApplyPromo } from '../api/hooks/promo/promo.hooks';

interface PromoModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PromoModal({ opened, onClose, onSuccess }: PromoModalProps) {
  const { t } = useTranslation();
  const [promoCode, setPromoCode] = useState('');
  const applyPromo = useApplyPromo();

  const handleApply = () => {
    if (!promoCode.trim()) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('promo.enterCode')),
        color: 'red',
      });
      return;
    }

    applyPromo.mutate(promoCode.trim(), {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('promo.applied')),
          color: 'green',
        });
        setPromoCode('');
        onClose();
        onSuccess?.();
      },
      onError: (error: unknown) => {
        const err = error as { response?: { data?: { error?: string } } };
        const errorMessage = err.response?.data?.error || String(t('promo.applyError'));
        notifications.show({
          title: String(t('common.error')),
          message: errorMessage,
          color: 'red',
        });
      },
    });
  };

  const handleClose = () => {
    setPromoCode('');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t('promo.title')}
    >
      <Stack gap="md">
        <TextInput
          label={t('promo.promoCode')}
          placeholder={t('promo.placeholder')}
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApply} loading={applyPromo.isPending}>
            {t('promo.apply')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
