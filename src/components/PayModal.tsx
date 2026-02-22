import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Stack, Group, Button, Text, NumberInput, Select, Loader, ActionIcon, Badge, Card } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { usePaySystems, useDeleteAutopayment } from '../api/hooks/pay/pay.hooks';
import type { GetPaysystemsCommand } from '@bkeenke/shm-contract';
import ConfirmModal from './ConfirmModal';

type PaySystem = GetPaysystemsCommand.Response[number];

interface PayModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function PayModal({ opened, onClose }: PayModalProps) {
  const { t } = useTranslation();

  const { data: rawPaySystems, isLoading: loading } = usePaySystems();
  const deleteAutopayment = useDeleteAutopayment();

  const paySystems = (() => {
    if (!rawPaySystems) return [];
    const seen = new Set<string>();
    return (rawPaySystems as PaySystem[])
      .filter((ps) => {
        if (seen.has(ps.shm_url)) return false;
        seen.add(ps.shm_url);
        return true;
      })
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
  })();

  const [selectedPaySystem, setSelectedPaySystem] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | string>(100);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [autopaymentToDelete, setAutopaymentToDelete] = useState<{ paysystem: string; name: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (paySystems.length > 0 && !selectedPaySystem) {
      setSelectedPaySystem(paySystems[0].shm_url);
    }
  }, [paySystems, selectedPaySystem]);

  const openDeleteConfirm = (paysystem: string, name: string) => {
    setAutopaymentToDelete({ paysystem, name });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteAutopayment = () => {
    if (!autopaymentToDelete) return;

    deleteAutopayment.mutate(autopaymentToDelete.paysystem, {
      onSuccess: () => {
        notifications.show({
          title: String(t('common.success')),
          message: String(t('payments.autopaymentDeleted')),
          color: 'green',
        });
        setDeleteConfirmOpen(false);
        setAutopaymentToDelete(null);
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('payments.autopaymentDeleteError')),
          color: 'red',
        });
      },
    });
  };

  const handlePay = async () => {
    const paySystem = paySystems.find(ps => ps.shm_url === selectedPaySystem);
    if (!paySystem) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('payments.selectPaymentSystem')),
        color: 'red',
      });
      return;
    }

    if (paySystem.internal || paySystem.recurring) {
      setProcessing(true);
      try {
        const response = await fetch(paySystem.shm_url + payAmount, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.status === 200 || response.status === 204) {
          notifications.show({
            title: String(t('common.success')),
            message: String(t('payments.paymentSuccess')),
            color: 'green',
          });
          onClose();
        } else {
          const data = await response.json().catch(() => ({}));
          notifications.show({
            title: String(t('common.error')),
            message: data.msg_ru || data.msg || String(t('payments.paymentError')),
            color: 'red',
          });
        }
      } catch {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('payments.paymentError')),
          color: 'red',
        });
      } finally {
        setProcessing(false);
      }
    } else {
      window.open(paySystem.shm_url + payAmount, '_blank');
      onClose();
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={t('payments.topUpBalance')}
      >
      <Stack gap="md">
        {loading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
            <Text size="sm">{t('payments.loadingPaymentSystems')}</Text>
          </Group>
        ) : paySystems.length === 0 ? (
          <Text c="dimmed">{t('payments.noPaymentSystems')}</Text>
        ) : (
          <>
            {paySystems.some(ps => ps.allow_deletion === 1) && (
              <Card withBorder p="sm" radius="md">
                <Text size="sm" fw={500} mb="xs">{t('payments.savedPaymentMethods')}</Text>
                <Stack gap="xs">
                  {paySystems.filter(ps => ps.allow_deletion === 1).map(ps => (
                    <Group key={ps.paysystem} justify="space-between">
                      <Group gap="xs">
                        <Text size="sm">{ps.name}</Text>
                        <Badge size="xs" variant="light" color="blue">{t('payments.autopayment')}</Badge>
                      </Group>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        loading={deleteAutopayment.isPending && autopaymentToDelete?.paysystem === ps.paysystem}
                        onClick={() => openDeleteConfirm(ps.paysystem, ps.name)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              </Card>
            )}
            <Select
              label={t('payments.paymentSystem')}
              placeholder={t('payments.selectPaymentSystem')}
              data={paySystems.map(ps => ({ value: ps.shm_url, label: ps.name }))}
              value={selectedPaySystem}
              onChange={setSelectedPaySystem}
            />
            <NumberInput
              label={t('payments.amount')}
              placeholder={t('payments.enterAmount')}
              value={payAmount}
              onChange={setPayAmount}
              min={1}
              step={10}
              decimalScale={2}
              suffix=" ₽"
            />
            <Group justify="flex-end">
              <Button variant="light" onClick={onClose} disabled={processing}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handlePay} disabled={!selectedPaySystem} loading={processing}>
                {t('payments.pay')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>

      <ConfirmModal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteAutopayment}
        title={t('payments.deletePaymentMethod')}
        message={t('payments.deletePaymentMethodConfirm', { name: autopaymentToDelete?.name || '' })}
        confirmLabel={t('common.delete')}
        confirmColor="red"
        loading={deleteAutopayment.isPending}
      />
    </>
  );
}
