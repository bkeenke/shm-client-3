import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Stack, Text, Card, Group, Badge, Loader, Center, Button, Paper, Divider, Select, NumberInput, Alert, Checkbox, ScrollArea } from '@mantine/core';
import { IconArrowLeft, IconCreditCard, IconCheck, IconWallet } from '@tabler/icons-react';
import { useServicesOrderList, useOrderService, useChangeService } from '../api/hooks/services/services.hooks';
import { useProfile } from '../api/hooks/user/user.hooks';
import { usePaySystems } from '../api/hooks/pay/pay.hooks';
import type { GetServicesForOrderCommand, GetPaysystemsCommand } from '@bkeenke/shm-contract';
import { notifications } from '@mantine/notifications';
import { config } from '../config';

type OrderService = GetServicesForOrderCommand.Response[number];
type PaySystem = GetPaysystemsCommand.Response[number];

interface OrderServiceModalProps {
  opened: boolean;
  onClose: () => void;
  onOrderSuccess?: () => void;
  mode?: 'order' | 'change';
  currentService?: {
    user_service_id: number;
    service_id: number;
    status: string;
    category: string;
    name?: string;
  };
  onChangeSuccess?: () => void;
}

function normalizeCategory(category: string): string {
  if (category.match(/remna|remnawave|marzban|marz|mz/i)) {
    return 'proxy';
  }
  if (category.match(/^(vpn|wg|awg)/i)) {
    return 'vpn';
  }
  if (['web_tariff', 'web', 'mysql', 'mail', 'hosting'].includes(category)) {
    return category;
  }
  return 'other';
}

export default function OrderServiceModal({
  opened,
  onClose,
  onOrderSuccess,
  mode = 'order',
  currentService,
  onChangeSuccess,
}: OrderServiceModalProps) {
  const { t } = useTranslation();
  const [selectedService, setSelectedService] = useState<OrderService | null>(null);
  const [selectedPaySystem, setSelectedPaySystem] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | string>(0);
  const [finishAfterActive, setFinishAfterActive] = useState(false);

  const isChangeMode = mode === 'change';
  const canDeferChange = isChangeMode && currentService?.status === 'ACTIVE';

  // Fetch services for order
  const filter = isChangeMode && currentService?.category ? { category: currentService.category } : undefined;
  const { data: servicesData = [], isLoading: loading } = useServicesOrderList(filter);

  // Filter services in change mode
  const services = useMemo(() => {
    if (isChangeMode && currentService?.service_id) {
      return servicesData.filter((service: OrderService) => service.service_id !== currentService.service_id);
    }
    return servicesData;
  }, [servicesData, isChangeMode, currentService?.service_id]);

  // Fetch user profile for balance (only in order mode)
  const { data: profileData } = useProfile();
  const userBalance = profileData?.balance || 0;

  // Fetch pay systems
  const { data: paySystemsData = [], isLoading: paySystemsLoading } = usePaySystems();
  const paySystems = paySystemsData as PaySystem[];

  useEffect(() => {
    if (opened) {
      setSelectedService(null);
      setFinishAfterActive(false);
    }
  }, [opened, mode, currentService?.service_id]);

  useEffect(() => {
    if (selectedService && !isChangeMode) {
      const needToPay = Math.max(0, Math.ceil((selectedService.cost - userBalance) * 100) / 100);
      setPayAmount(needToPay);
      if (userBalance < selectedService.cost && paySystems.length > 0 && !selectedPaySystem) {
        setSelectedPaySystem(paySystems[0].name);
      }
    }
  }, [selectedService, userBalance, isChangeMode, paySystems, selectedPaySystem]);

  useEffect(() => {
    if (isChangeMode) {
      setFinishAfterActive(false);
    }
  }, [selectedService, isChangeMode]);

  // Mutations
  const orderService = useOrderService();
  const changeService = useChangeService();
  const ordering = orderService.isPending || changeService.isPending;

  const handleOrder = () => {
    if (!selectedService) return;

    orderService.mutate(
      selectedService.service_id,
      {
        onSuccess: () => {
          notifications.show({
            title: String(t('common.success')),
            message: String(t('order.orderSuccess', { name: selectedService.name })),
            color: 'green',
          });
          onOrderSuccess?.();
          handleClose();
        },
        onError: () => {
          notifications.show({
            title: String(t('common.error')),
            message: String(t('order.orderError')),
            color: 'red',
          });
        },
      }
    );
  };

  const handleOrderAndPay = () => {
    if (!selectedService) return;

    const paySystem = paySystems.find(ps => ps.name === selectedPaySystem);
    if (!paySystem) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('payments.selectPaymentSystem')),
        color: 'red',
      });
      return;
    }

    orderService.mutate(
      selectedService.service_id,
      {
        onSuccess: () => {
          window.open(paySystem.shm_url + payAmount, '_blank');
          notifications.show({
            title: String(t('common.success')),
            message: String(t('order.orderPaySuccess', { name: selectedService.name })),
            color: 'green',
          });
          onOrderSuccess?.();
          handleClose();
        },
        onError: () => {
          notifications.show({
            title: String(t('common.error')),
            message: String(t('order.orderError')),
            color: 'red',
          });
        },
      }
    );
  };

  const handleChange = () => {
    if (!selectedService || !currentService) return;

    const finishActive = canDeferChange && finishAfterActive ? 1 : 0;

    changeService.mutate(
      {
        userServiceId: currentService.user_service_id,
        serviceId: selectedService.service_id,
        finishActive,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: String(t('common.success')),
            message: String(t('services.changeServiceSuccess')),
            color: 'green',
          });
          onChangeSuccess?.();
          handleClose();
        },
        onError: () => {
          notifications.show({
            title: String(t('common.error')),
            message: String(t('services.changeServiceError')),
            color: 'red',
          });
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedService(null);
    setFinishAfterActive(false);
    onClose();
  };

  const handleBack = () => {
    setSelectedService(null);
    setFinishAfterActive(false);
  };

  const groupedServices = services.reduce((acc, service) => {
    const category = normalizeCategory(service.category || 'other');

    if (config.VISIBLE_CATEGORIES) {
      const visibleCategories = config.VISIBLE_CATEGORIES.split(',').map(c => c.trim().toLowerCase());
      const rawCategory = (service.category || 'other').toLowerCase();
      const normalizedCategory = category.toLowerCase();
      if (!visibleCategories.includes(rawCategory) && !visibleCategories.includes(normalizedCategory)) {
        return acc;
      }
    }

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, OrderService[]>);
  (Object.values(groupedServices) as OrderService[][]).forEach((categoryServices) => {
    categoryServices.sort((a, b) => a.cost - b.cost);
  });

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        selectedService
          ? t('order.serviceDetails')
          : (isChangeMode ? t('services.changeServiceTitle') : t('order.title'))
      }
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {loading ? (
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      ) : selectedService ? (
        <Stack gap="md">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBack}
            size="compact-sm"
            w="fit-content"
          >
            {t('order.backToList')}
          </Button>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700} size="lg">{selectedService.name}</Text>
              </Group>

              <Divider />

              {selectedService.descr && (
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedService.descr}
                </Text>
              )}

              <Group justify="space-between" mt="md">
                <div>
                  <Text size="sm" c="dimmed">{t('services.cost')}</Text>
                  <Text fw={600} size="lg">{selectedService.cost} ₽</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">{t('order.period')}</Text>
                  <Text fw={500}>
                    {selectedService.period === 1 ? t('common.month') :
                     selectedService.period === 3 ? t('common.months3') :
                     selectedService.period === 6 ? t('common.months6') :
                     selectedService.period === 12 ? t('common.year') :
                     `${selectedService.period} ${t('common.months')}`}
                  </Text>
                </div>
              </Group>
            </Stack>
          </Paper>

          {isChangeMode ? (
            <Stack gap="sm">
              {canDeferChange && (
                <Checkbox
                  label={t('services.changeAfterEnd')}
                  checked={finishAfterActive}
                  onChange={(event) => setFinishAfterActive(event.currentTarget.checked)}
                />
              )}
              <Button
                fullWidth
                size="md"
                color="blue"
                leftSection={<IconCheck size={18} />}
                onClick={handleChange}
                loading={ordering}
              >
                {t('services.changeService')}
              </Button>
            </Stack>
          ) : (
            <>
              <Alert
                variant="light"
                color={userBalance >= selectedService.cost ? 'green' : 'yellow'}
                icon={<IconWallet size={18} />}
              >
                <Group justify="space-between">
                  <Text size="sm">{t('order.yourBalance')}: <Text span fw={600}>{userBalance} ₽</Text></Text>
                  {userBalance >= selectedService.cost ? (
                    <Badge color="green" variant="light">{t('order.enoughToPay')}</Badge>
                  ) : (
                    <Badge color="yellow" variant="light">{t('order.needTopUp', { amount: Math.ceil((selectedService.cost - userBalance) * 100) / 100 })}</Badge>
                  )}
                </Group>
              </Alert>

              {userBalance >= selectedService.cost ? (
                <Button
                  fullWidth
                  size="md"
                  color="green"
                  leftSection={<IconCheck size={18} />}
                  onClick={handleOrder}
                  loading={ordering}
                >
                  {t('order.orderFor', { amount: selectedService.cost })}
                </Button>
              ) : (
                <>
                  <Paper withBorder p="md" radius="md">
                    <Stack gap="md">
                      <Text fw={500}>{t('order.topUpBalance')}</Text>

                      {paySystemsLoading ? (
                        <Group justify="center" py="md">
                          <Loader size="sm" />
                          <Text size="sm">{t('payments.loadingPaymentSystems')}</Text>
                        </Group>
                      ) : paySystems.length === 0 ? (
                        <Text c="dimmed" size="sm">{t('payments.noPaymentSystems')}</Text>
                      ) : (
                        <>
                          <Select
                            label={t('payments.paymentSystem')}
                            placeholder={t('payments.selectPaymentSystem')}
                            data={paySystems.map(ps => ({ value: ps.name, label: ps.name }))}
                            value={selectedPaySystem}
                            onChange={setSelectedPaySystem}
                          />
                          <NumberInput
                            label={t('payments.amount')}
                            placeholder={t('payments.enterAmount')}
                            value={payAmount}
                            onChange={setPayAmount}
                            min={Math.ceil((selectedService.cost - userBalance) * 100) / 100}
                            step={10}
                            decimalScale={2}
                            suffix=" ₽"
                            description={`${t('order.minimum')}: ${(Math.ceil((selectedService.cost - userBalance) * 100) / 100).toFixed(2)} ₽ (${t('order.missingAmount')})`}
                          />
                        </>
                      )}
                    </Stack>
                  </Paper>

                  <Button
                    fullWidth
                    size="md"
                    leftSection={<IconCreditCard size={18} />}
                    onClick={handleOrderAndPay}
                    loading={ordering}
                    disabled={!selectedPaySystem || paySystemsLoading}
                  >
                    {t('order.orderAndPay', { amount: payAmount })}
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      ) : services.length === 0 ? (
        <Center h={200}>
          <Text c="dimmed">{t('order.noServicesAvailable')}</Text>
        </Center>
      ) : (
        <Stack gap="md">
          {(Object.entries(groupedServices) as [string, OrderService[]][]).map(([category, categoryServices]) => (
            <div key={category}>
              <Text fw={500} size="sm" c="dimmed" mb="xs">
                {t(`categories.${category}`)}
              </Text>
              <Stack gap="xs">
                {categoryServices.map((service) => (
                  <Card
                    key={service.service_id}
                    withBorder
                    radius="md"
                    p="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedService(service)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>{service.name}</Text>
                        {service.descr && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {service.descr}
                          </Text>
                        )}
                      </div>
                      <Group gap="sm">
                        <Text fw={600}>{service.cost} ₽</Text>
                        <Text size="xs" c="dimmed">
                          / {service.period === 1 ? t('common.month') :
                             service.period === 3 ? t('common.months3') :
                             service.period === 6 ? t('common.months6') :
                             service.period === 12 ? t('common.year') :
                             `${service.period} ${t('common.months')}`}
                        </Text>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
