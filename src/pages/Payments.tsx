import { useState } from 'react';
import { Card, Text, Stack, Group, Badge, Button, Loader, Center, Paper, Title, Table, Pagination, LoadingOverlay } from '@mantine/core';
import { IconCreditCard, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import PayModal from '../components/PayModal';
import { usePayments } from '../api/hooks';
import { GetUserPaymentsCommand } from '@bkeenke/shm-contract';

type Payment = GetUserPaymentsCommand.Response[number];

export default function Payments() {
  const [page, setPage] = useState(1);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const perPage = 10;
  const { user } = useStore();
  const { t, i18n } = useTranslation();

  const offset = (page - 1) * perPage;
  const { data, isLoading, isFetching } = usePayments({ limit: perPage, offset });

  const payments = (data?.payments ?? []) as Payment[];
  const totalItems = data?.totalItems ?? 0;
  const totalPages = Math.ceil(totalItems / perPage);

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
        <Title order={2}>{t('payments.title')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setPayModalOpen(true)}>{t('payments.topUpBalance')}</Button>
      </Group>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between">
          <Group>
            <IconCreditCard size={24} />
            <div>
              <Text size="sm" c="dimmed">{t('payments.currentBalance')}</Text>
              <Text size="xl" fw={700}>{user?.balance ?? 0} {t('common.currency')}</Text>
            </div>
          </Group>
          {user?.credit && user.credit > 0 && (
            <Badge color="orange" size="lg" variant="light">{t('profile.credit')}: {user.credit} {t('common.currency')}</Badge>
          )}
          {user?.discount && user.discount > 0 && (
            <Badge color="orange" size="lg" variant="light">{t('payments.discount')}: {user.discount} %</Badge>
          )}
        </Group>
      </Card>

      {payments.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center>
            <Text c="dimmed">{t('payments.historyEmpty')}</Text>
          </Center>
        </Paper>
      ) : (
        <>
          <Paper withBorder radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
            <LoadingOverlay visible={isFetching && !isLoading} overlayProps={{ blur: 1 }} />
            <Table.ScrollContainer minWidth={500}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('payments.date')}</Table.Th>
                    <Table.Th>{t('payments.paymentSystem')}</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>{t('payments.amount')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.map((payment) => (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <Text size="sm">{new Date(payment.date).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{payment.pay_system_id || '-'}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text
                          size="sm"
                          fw={500}
                          c={payment.money > 0 ? 'green' : 'red'}
                        >
                          {payment.money > 0 ? '+' : ''}{payment.money} {t('common.currency')}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>

          {totalPages > 1 && (
            <Center>
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Center>
          )}
        </>
      )}

      <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} />
    </Stack>
  );
}