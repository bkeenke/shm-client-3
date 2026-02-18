import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Stack, Loader, Center, Paper, Title, Table, Pagination, Badge, LoadingOverlay } from '@mantine/core';
import { api } from '../api/client';

interface Withdraw {
  withdraw_id: number;
  user_service_id: number;
  service_id: number;
  cost: number;
  total: number;
  discount: number;
  bonus: number;
  months: number;
  qnt: number;
  create_date: string;
  withdraw_date: string;
  end_date: string;
}

export default function Withdrawals() {
  const { t, i18n } = useTranslation();
  const [withdrawals, setWithdrawals] = useState<Withdraw[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 10;

  const fetchWithdrawals = async (p: number, isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    else setTableLoading(true);
    try {
      const offset = (p - 1) * perPage;
      const response = await api.get('/user/withdraw', { params: { limit: perPage, offset } });
      setWithdrawals(response.data.data || []);
      if (typeof response.data.items === 'number') {
        setTotalItems(response.data.items);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    } finally {
      setInitialLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals(1, true);
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      fetchWithdrawals(page);
    }
  }, [page]);

  const totalPages = Math.ceil(totalItems / perPage);

  if (initialLoading) {
    return (
      <Center h={300}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>{t('withdrawals.title')}</Title>

      {withdrawals.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center>
            <Text c="dimmed">{t('withdrawals.historyEmpty')}</Text>
          </Center>
        </Paper>
      ) : (
        <>
          <Paper withBorder radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
            <LoadingOverlay visible={tableLoading} overlayProps={{ blur: 1 }} />
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>{t('withdrawals.withdrawDate')}</Table.Th>
                    <Table.Th>{t('withdrawals.endDate')}</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>{t('services.cost')}</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>{t('payments.discount')}</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>{t('profile.bonus')}</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>{t('withdrawals.total')}</Table.Th>
                    <Table.Th>{t('order.period')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {withdrawals.map((w) => (
                    <Table.Tr key={w.withdraw_id}>
                      <Table.Td>
                        <Text size="sm">{w.withdraw_id}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {w.withdraw_date ? new Date(w.withdraw_date).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {w.end_date ? new Date(w.end_date).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm">{w.cost} ₽</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {w.discount > 0 ? (
                          <Text size="sm" c="green">-{w.discount}%</Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {w.bonus > 0 ? (
                          <Text size="sm" c="red">-{w.bonus} ₽</Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={500} w={80} c="red">-{w.total} ₽</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {w.months} {t('common.months')} × {w.qnt}
                        </Badge>
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
    </Stack>
  );
}
