import { useState, useEffect, useRef } from 'react';
import { Card, Text, Stack, Group, Badge, Button, Modal, ActionIcon, Loader, Center, Paper, Title, Tabs, Code, Tooltip, Accordion, Box, Select, NumberInput, Pagination } from '@mantine/core';
import { IconQrcode, IconCopy, IconCheck, IconDownload, IconRefresh, IconTrash, IconPlus, IconPlayerStop, IconExchange, IconCreditCard, IconWallet } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import QrModal from '../components/QrModal';
import OrderServiceModal from '../components/OrderServiceModal';
import ConfirmModal from '../components/ConfirmModal';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { config } from '../config';
import {
  useUserServices,
  useStopService,
  useDeleteService,
  useServicesOrderList,
  usePaymentForecast,
  usePaySystems,
  useStorageItem,
} from '../api/hooks';
import { GetUserServicesCommand } from '@bkeenke/shm-contract';

type UserService = GetUserServicesCommand.Response[number] & {
  children?: UserService[];
};

interface ForecastItem {
  name: string;
  cost: number;
  total: number;
  status: string;
  user_service_id: string;
}

const statusColors: Record<string, string> = {
  'ACTIVE': 'green',
  'NOT PAID': 'blue',
  'BLOCK': 'red',
  'PROGRESS': 'yellow',
  'ERROR': 'orange',
  'INIT': 'gray',
};

function normalizeCategory(category: string): string {
  if ( config.PROXY_CATEGORY === category ) {
    return 'proxy';
  }
  if ( config.VPN_CATEGORY === category ) {
    return 'vpn';
  }
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

interface ServiceDetailProps {
  service: UserService;
  onDelete?: () => void;
  onChangeTariff?: (service: UserService) => void;
}

function ServiceDetail({ service, onDelete, onChangeTariff }: ServiceDetailProps) {
  const [activeTab, setActiveTab] = useState<string | null>('info');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedPaySystem, setSelectedPaySystem] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | string>(0);
  const [paying, setPaying] = useState(false);
  const { t, i18n } = useTranslation();
  const { copied: urlCopied, copy: copyUrl } = useCopyToClipboard();

  const category = normalizeCategory(service.service.category);
  const isVpn = category === 'vpn';
  const isProxy = category === 'proxy';
  const isVpnOrProxy = isVpn || isProxy;
  const canDelete = ['BLOCK', 'NOT PAID', 'ERROR'].includes(service.status);
  const canStop = service.status === 'ACTIVE';
  const canChange = ['BLOCK', 'ACTIVE'].includes(service.status);
  const isNotPaid = service.status === 'NOT PAID';

  // Hooks for mutations
  const stopServiceMutation = useStopService();
  const deleteServiceMutation = useDeleteService();

  // Hooks for queries
  const { data: forecastData, isLoading: forecastLoading } = usePaymentForecast();
  const { data: paySystemsData, isLoading: paySystemsLoading } = usePaySystems();

  // Storage hooks
  const proxyPrefix = config.PROXY_STORAGE_PREFIX || 'vpn_mrzb_';
  const vpnPrefix = config.VPN_STORAGE_PREFIX || 'vpn';

  const { data: proxyStorageData } = useStorageItem(
    `${proxyPrefix}${service.user_service_id}`,
    { enabled: isProxy && service.status === 'ACTIVE', format: 'json' }
  );

  const { data: vpnStorageData } = useStorageItem(
    `${vpnPrefix}${service.user_service_id}`,
    { enabled: isVpn && service.status === 'ACTIVE', format: 'raw' }
  );

  // Next service info
  const { data: nextServiceData, isLoading: nextServiceLoading } = useServicesOrderList(
    service.next ? { service_id: service.next } : undefined
  );

  const subscriptionUrl = proxyStorageData?.subscriptionUrl || null;
  const storageData = typeof vpnStorageData?.raw === 'string' ? vpnStorageData.raw : null;

  const nextServiceInfo = nextServiceData && nextServiceData.length > 0
    ? { name: nextServiceData[0].name, cost: nextServiceData[0].cost }
    : null;

  // Calculate forecast
  const forecastTotal = (() => {
    if (!isNotPaid || !forecastData) return null;
    const balance = (forecastData as { balance?: number })?.balance || 0;
    const items = (forecastData as { items?: ForecastItem[] })?.items;
    const item = items?.find((it: ForecastItem) => String(it.user_service_id) === String(service.user_service_id));
    if (item) {
      return Math.max(0, Math.ceil((item.total - balance) * 100) / 100);
    }
    const total = (forecastData as { total?: number })?.total;
    return total && total > 0 ? Math.max(0, Math.ceil(total * 100) / 100) : null;
  })();

  // Pay systems
  const paySystems = paySystemsData
    ? [...paySystemsData].sort((a, b) => ((b as { weight?: number }).weight || 0) - ((a as { weight?: number }).weight || 0))
    : [];

  useEffect(() => {
    if (forecastTotal !== null && forecastTotal > 0) {
      setPayAmount(forecastTotal);
    }
  }, [forecastTotal]);

  useEffect(() => {
    if (paySystems.length > 0 && !selectedPaySystem) {
      setSelectedPaySystem((paySystems[0] as { shm_url: string }).shm_url);
    }
  }, [paySystems, selectedPaySystem]);

  useEffect(() => {
    if ((subscriptionUrl || storageData) && service.status === 'ACTIVE') {
      setActiveTab('config');
    }
  }, [subscriptionUrl, storageData, service.status]);

  const downloadConfig = async () => {
    if (!storageData) return;
    setDownloading(true);
    try {
      const blob = new Blob([storageData], { type: 'application/octet-stream' });
      const prefix = config.VPN_STORAGE_PREFIX ? config.VPN_STORAGE_PREFIX : 'vpn';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}${service.user_service_id}.conf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handlePay = async () => {
    const paySystem = paySystems.find((ps: { shm_url: string }) => ps.shm_url === selectedPaySystem) as { shm_url: string; internal?: number; recurring?: number; name: string } | undefined;
    if (!paySystem) return;
    setPaying(true);
    try {
      if (paySystem.internal || paySystem.recurring) {
        const response = await fetch(paySystem.shm_url + payAmount, {
          method: 'GET',
          credentials: 'include',
        });
        if (response.status === 200 || response.status === 204) {
          notifications.show({ title: t('common.success'), message: t('payments.paymentSuccess'), color: 'green' });
          onDelete?.();
        } else {
          const data = await response.json().catch(() => ({}));
          notifications.show({ title: t('common.error'), message: data.msg_ru || data.msg || t('payments.paymentError'), color: 'red' });
        }
      } else {
        window.open(paySystem.shm_url + payAmount, '_blank');
      }
    } catch {
      notifications.show({ title: t('common.error'), message: t('payments.paymentError'), color: 'red' });
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteServiceMutation.mutateAsync(service.user_service_id);
      notifications.show({
        title: t('common.success'),
        message: t('services.serviceDeleted'),
        color: 'green',
      });
      setConfirmDelete(false);
      onDelete?.();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('services.serviceDeleteError'),
        color: 'red',
      });
    }
  };

  const handleStop = async () => {
    try {
      await stopServiceMutation.mutateAsync(service.user_service_id);
      notifications.show({
        title: t('common.success'),
        message: t('services.serviceStopped'),
        color: 'green',
      });
      setConfirmStop(false);
      onDelete?.();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('services.serviceStopError'),
        color: 'red',
      });
    }
  };

  const statusColor = statusColors[service.status] || 'gray';
  const statusLabel = String(t(`status.${service.status}`, service.status));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text fw={700} size="lg">#{service.user_service_id} - {service.service.name}</Text>
          <Badge color={statusColor} variant="light">
            {statusLabel}
          </Badge>
        </div>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="info">{t('services.info')}</Tabs.Tab>
          {isVpnOrProxy && service.status === 'ACTIVE' && <Tabs.Tab value="config">{t('services.connection')}</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="info" pt="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('services.status')}:</Text>
              <Badge color={statusColor} variant="light">{statusLabel}</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('services.cost')}:</Text>
              <Text size="sm">{service.service.cost} {t('common.currency')}</Text>
            </Group>
            {service.expire && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">{t('services.validUntil')}:</Text>
                <Text size="sm">{new Date(service.expire as string).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}</Text>
              </Group>
            )}
            {service.next && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">{t('services.validUntilNext')}:</Text>
                {nextServiceLoading ? (
                  <Text size="sm">{t('common.loading')}</Text>
                ) : nextServiceInfo ? (
                  <Text size="sm">{nextServiceInfo.name} - {nextServiceInfo.cost} {t('common.currency')}</Text>
                ) : (
                  <Text size="sm">{service.next}</Text>
                )}
              </Group>
            )}
            {service.children && service.children.length > 0 && (
              <>
                <Text size="sm" c="dimmed" mt="md">{t('services.includedServices')}:</Text>
                {service.children.map((child: UserService) => {
                  const childStatusColor = statusColors[child.status] || 'gray';
                  const childStatusLabel = String(t(`status.${child.status}`, child.status));
                  return (
                    <Group key={child.user_service_id} justify="space-between" ml="md">
                      <Text size="sm">{child.service.name}</Text>
                      <Badge size="sm" color={childStatusColor} variant="light">{childStatusLabel}</Badge>
                    </Group>
                  );
                })}
              </>
            )}
          </Stack>
        </Tabs.Panel>

        { service.status === 'ACTIVE' && (
          <Tabs.Panel value="config" pt="md">
            <Stack gap="md">
              {isProxy && subscriptionUrl && (
                <Paper withBorder p="md" radius="md">
                  <Text size="sm" fw={500} mb="xs">{t('services.subscriptionLink')}</Text>
                  <Group gap="xs">
                    <Code style={{ flex: 1, wordBreak: 'break-all' }}>{subscriptionUrl}</Code>
                    <Tooltip label={urlCopied ? t('common.copied') : t('common.copy')}>
                      <ActionIcon color={urlCopied ? 'teal' : 'gray'} variant="subtle" onClick={() => copyUrl(subscriptionUrl)}>
                        {urlCopied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              )}

              <Group>
                {(isVpn && storageData) || (isProxy && subscriptionUrl) ? (
                  <Button
                    leftSection={<IconQrcode size={16} />}
                    variant="light"
                    onClick={() => setQrModalOpen(true)}
                  >
                    {t('services.qrCode')}
                  </Button>
                ) : null}

              {isVpn && storageData && (
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  onClick={downloadConfig}
                  loading={downloading}
                >
                  {t('services.downloadConfig')}
                </Button>
              )}
              </Group>

              <QrModal
                opened={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                data={isVpn ? (storageData || '') : (subscriptionUrl || '')}
                title={isVpn ? t('services.vpnQrTitle') : t('services.subscriptionQrTitle')}
                onDownload={isVpn ? downloadConfig : undefined}
              />
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      {isNotPaid && (
        <Paper withBorder p="md" radius="md" mt="md">
          <Stack gap="sm">
            {forecastLoading ? (
              <Group justify="center" py="xs">
                <Loader size="sm" />
                <Text size="sm">{t('common.loading')}</Text>
              </Group>
            ) : forecastTotal !== null && forecastTotal > 0 ? (
              <>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconWallet size={18} />
                    <Text fw={500}>{t('services.amountToPay')}</Text>
                  </Group>
                  <Text fw={700} size="lg" c="red">{forecastTotal.toFixed(2)} {t('common.currency')}</Text>
                </Group>
                {paySystemsLoading ? (
                  <Group justify="center" py="xs">
                    <Loader size="sm" />
                  </Group>
                ) : paySystems.length > 0 ? (
                  <>
                    <Select
                      label={t('payments.paymentSystem')}
                      data={paySystems.map((ps: { shm_url: string; name: string }) => ({ value: ps.shm_url, label: ps.name }))}
                      value={selectedPaySystem}
                      onChange={setSelectedPaySystem}
                      size="sm"
                    />
                    <NumberInput
                      label={t('payments.amount')}
                      value={payAmount}
                      onChange={setPayAmount}
                      min={1}
                      step={10}
                      decimalScale={2}
                      suffix=" ₽"
                      size="sm"
                    />
                    <Button
                      fullWidth
                      leftSection={<IconCreditCard size={18} />}
                      onClick={handlePay}
                      loading={paying}
                      disabled={!selectedPaySystem}
                    >
                      {t('services.payService', { amount: payAmount })}
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </Paper>
      )}

      {canChange && (
        <Button
          color="blue"
          variant="light"
          leftSection={<IconExchange size={16} />}
          onClick={() => onChangeTariff?.(service)}
          mt="md"
          fullWidth
        >
          {t('services.changeService')}
        </Button>
      )}

      {canStop && (
        <Button
          color="orange"
          variant="light"
          leftSection={<IconPlayerStop size={16} />}
          onClick={() => setConfirmStop(true)}
          mt="md"
          fullWidth
        >
          {t('services.stopService')}
        </Button>
      )}

      {canDelete && (
        <Button
          color="red"
          variant="light"
          leftSection={<IconTrash size={16} />}
          onClick={() => setConfirmDelete(true)}
          mt="md"
          fullWidth
        >
          {t('services.deleteService')}
        </Button>
      )}

      <ConfirmModal
        opened={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={handleStop}
        title={t('services.stopServiceTitle')}
        message={t('services.stopServiceMessage')}
        confirmLabel={t('services.stop')}
        confirmColor="orange"
        loading={stopServiceMutation.isPending}
      />

      <ConfirmModal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t('services.deleteServiceTitle')}
        message={t('services.deleteServiceMessage')}
        confirmLabel={t('common.delete')}
        confirmColor="red"
        loading={deleteServiceMutation.isPending}
      />
    </Stack>
  );
}

function ServiceCard({ service, onClick, isChild = false, isLastChild = false }: { service: UserService; onClick: () => void; isChild?: boolean; isLastChild?: boolean }) {
  const { t, i18n } = useTranslation();
  const statusColor = statusColors[service.status] || 'gray';
  const statusLabel = String(t(`status.${service.status}`, service.status));

  if (isChild) {
    return (
      <Group gap={0} wrap="nowrap" align="stretch">
        <Box
          style={{
            width: 24,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <Box
            style={{
              position: 'absolute',
              left: 10,
              top: 0,
              bottom: isLastChild ? '50%' : 0,
              width: 2,
              backgroundColor: 'var(--mantine-color-gray-4)',
            }}
          />
          <Box
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              width: 14,
              height: 2,
              backgroundColor: 'var(--mantine-color-gray-4)',
            }}
          />
        </Box>
        <Card
          withBorder
          radius="md"
          p="sm"
          style={{ cursor: 'pointer', flex: 1 }}
          onClick={onClick}
        >
          <Group justify="space-between">
            <div>
              <Text fw={500} size="sm">#{service.user_service_id} - {service.service.name}</Text>
              {service.expire && (
                <Text size="xs" c="dimmed">
                  {new Date(service.expire as string).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
                </Text>
              )}
            </div>
            <Group gap="sm">
              {service.service.cost > 0 && (
                <Text size="sm" c="dimmed">{service.service.cost} {t('common.currency')}</Text>
              )}
              <Badge color={statusColor} variant="light" size="sm">
                {statusLabel}
              </Badge>
            </Group>
          </Group>
        </Card>
      </Group>
    );
  }

  return (
    <Card
      withBorder
      radius="md"
      p="md"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <Group justify="space-between">
        <div>
          <Text fw={500}>#{service.user_service_id} - {service.service.name}</Text>
          {service.expire && (
            <Text size="xs" c="dimmed">
              {new Date(service.expire as string).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
            </Text>
          )}
        </div>
        <Group gap="sm">
          {service.service.cost > 0 && (
            <Text size="sm" c="dimmed">{service.service.cost} {t('common.currency')}</Text>
          )}
          <Badge color={statusColor} variant="light">
            {statusLabel}
          </Badge>
        </Group>
      </Group>
    </Card>
  );
}

export default function Services() {
  const [selectedService, setSelectedService] = useState<UserService | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [orderModalOpened, { open: openOrderModal, close: closeOrderModal }] = useDisclosure(false);
  const [changeModalOpened, { open: openChangeModal, close: closeChangeModal }] = useDisclosure(false);
  const [changeService, setChangeService] = useState<UserService | null>(null);
  const refreshAttemptsRef = useRef(0);
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const perPage = 5;
  const { t } = useTranslation();

  const { data: servicesData, isLoading, refetch } = useUserServices();

  // Build services tree with children
  const services = (() => {
    if (!servicesData) return [];
    const data = servicesData as UserService[];
    const serviceMap = new Map<number, UserService>();
    data.forEach(s => serviceMap.set(s.user_service_id, { ...s, children: [] }));

    const rootServices: UserService[] = [];
    serviceMap.forEach(service => {
      if (service.parent && serviceMap.has(service.parent)) {
        const parent = serviceMap.get(service.parent)!;
        parent.children = parent.children || [];
        parent.children.push(service);
      } else if (!service.parent) {
        rootServices.push(service);
      }
    });

    return rootServices;
  })();

  const hasProgressServices = (serviceList: UserService[]): boolean => {
    for (const service of serviceList) {
      if (service.status === 'PROGRESS') return true;
      if (service.children && hasProgressServices(service.children)) return true;
    }
    return false;
  };

  const hasNotPaidServices = (serviceList: UserService[]): boolean => {
    for (const service of serviceList) {
      if (service.status === 'NOT PAID') return true;
      if (service.children && hasNotPaidServices(service.children)) return true;
    }
    return false;
  };

  // Auto-refresh for PROGRESS status
  useEffect(() => {
    if (!services.length || isLoading) return;

    const hasProgress = hasProgressServices(services);

    if (hasProgress && refreshAttemptsRef.current < 2) {
      const delay = refreshAttemptsRef.current === 0 ? 1000 : 3000;
      const timer = setTimeout(async () => {
        refreshAttemptsRef.current += 1;
        await refetch();
      }, delay);
      return () => clearTimeout(timer);
    }

    if (!hasProgress) {
      refreshAttemptsRef.current = 0;
    }
  }, [services, isLoading, refetch]);

  // Auto-refresh for NOT PAID status
  useEffect(() => {
    if (!services.length || isLoading) return;

    const hasNotPaid = hasNotPaidServices(services);
    if (!hasNotPaid) return;

    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [services, isLoading, refetch]);

  const handleServiceClick = (service: UserService) => {
    setSelectedService(service);
    open();
  };

  const handleChangeTariff = (service: UserService) => {
    setChangeService(service);
    close();
    openChangeModal();
  };

  const handleRefresh = () => {
    refreshAttemptsRef.current = 0;
    refetch();
  };

  const groupedServices = services.reduce((acc, service) => {
    const category = normalizeCategory(service.service.category);

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, UserService[]>);

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('services.title')}</Title>
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openOrderModal}>
            {t('services.orderService')}
          </Button>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleRefresh}>
            {t('common.refresh')}
          </Button>
        </Group>
      </Group>

      {Object.keys(groupedServices).length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center>
            <Stack align="center" gap="md">
              <Text c="dimmed">{t('services.noServices')}</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={openOrderModal}>
                {t('services.orderService')}
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Accordion variant="separated" radius="md" multiple defaultValue={Object.keys(groupedServices)}>
          {(Object.entries(groupedServices) as [string, UserService[]][]).map(([category, categoryServices]) => {
            const page = categoryPages[category] || 1;
            const totalPages = Math.ceil(categoryServices.length / perPage);
            const paginatedServices = categoryServices.slice((page - 1) * perPage, page * perPage);
            return (
            <Accordion.Item key={category} value={category}>
              <Accordion.Control>
                <Group>
                  <Text fw={500}>{t(`categories.${category}`, category)}</Text>
                  <Badge variant="light" size="sm">{categoryServices.length}</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {paginatedServices.map((service: UserService) => (
                    <Box key={service.user_service_id}>
                      <ServiceCard
                        service={service}
                        onClick={() => handleServiceClick(service)}
                      />
                      {service.children && service.children.length > 0 && (
                        <Stack gap="xs" mt="xs" ml="md">
                          {service.children.map((child: UserService, index: number) => (
                            <ServiceCard
                              key={child.user_service_id}
                              service={child}
                              onClick={() => handleServiceClick(child)}
                              isChild
                              isLastChild={index === service.children!.length - 1}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  ))}
                  {totalPages > 1 && (
                    <Center mt="xs">
                      <Pagination
                        total={totalPages}
                        value={page}
                        onChange={(p) => setCategoryPages(prev => ({ ...prev, [category]: p }))}
                        size="sm"
                      />
                    </Center>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      <Modal opened={opened} onClose={close} title={t('services.serviceDetails')} size="lg">
        {selectedService && (
          <ServiceDetail
            service={selectedService}
            onDelete={() => {
              close();
              refreshAttemptsRef.current = 0;
              refetch();
            }}
            onChangeTariff={handleChangeTariff}
          />
        )}
      </Modal>

      <OrderServiceModal
        opened={orderModalOpened}
        onClose={closeOrderModal}
        onOrderSuccess={() => {
          refreshAttemptsRef.current = 0;
          refetch();
        }}
      />

      <OrderServiceModal
        opened={changeModalOpened}
        onClose={() => {
          setChangeService(null);
          closeChangeModal();
        }}
        mode="change"
        currentService={
          changeService
            ? {
                user_service_id: changeService.user_service_id,
                service_id: changeService.service_id,
                status: changeService.status,
                category: changeService.service.category,
                name: changeService.service.name,
              }
            : undefined
        }
        onChangeSuccess={() => {
          refreshAttemptsRef.current = 0;
          refetch();
        }}
      />
    </Stack>
  );
}