import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Stack, Loader, Center, Paper, Title, Table, Pagination, Badge, LoadingOverlay } from '@mantine/core';
import { GetUserWithdrawalsCommand } from '@bkeenke/shm-contract';
import { useWithdrawals } from '../api/hooks';

type Withdraw = GetUserWithdrawalsCommand.Response[number];

export default function Withdrawals() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const perPage = 10;

  const offset = (page - 1) * perPage;
  const { data, isLoading, isFetching } = useWithdrawals({ limit: perPage, offset });

  const withdrawals = (data?.withdrawals ?? []) as Withdraw[];
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
            <LoadingOverlay visible={isFetching && !isLoading} overlayProps={{ blur: 1 }} />
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
