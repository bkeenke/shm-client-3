import { useState, useEffect, useCallback } from 'react';
import { Card, Text, Stack, Group, Button, TextInput, Avatar, Title, Modal, Loader, Center, Collapse, Alert, useMantineColorScheme } from '@mantine/core';
import { IconUser, IconPhone, IconBrandTelegram, IconWallet, IconCreditCard, IconChevronDown, IconChevronUp, IconMail, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import PayModal from '../components/PayModal';
import PromoModal from '../components/PromoModal';
import SecuritySettings from '../components/security/SecuritySettings';
import { useStore } from '../store/useStore';
import { useProfile, useUpdateProfile, useSetEmail, useSendVerifyCode, useConfirmEmail } from '../api/hooks/user/user.hooks';
import { useTelegramSettings, useUpdateTelegramSettings } from '../api/hooks/telegram/telegram.hooks';
import { usePaymentForecast } from '../api/hooks/pay/pay.hooks';

const RESEND_COOLDOWN_MS = 3 * 60 * 1000;
const RESEND_STORAGE_KEY = 'email_verify_last_sent';

export default function Profile() {
  const { telegramPhoto } = useStore();
  const { colorScheme } = useMantineColorScheme();
  const { t } = useTranslation();

  // Data hooks
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();
  const { data: telegramSettings } = useTelegramSettings();
  const { data: forecast } = usePaymentForecast();

  // Mutation hooks
  const updateProfile = useUpdateProfile();
  const updateTelegram = useUpdateTelegramSettings();
  const setEmail = useSetEmail();
  const sendVerifyCode = useSendVerifyCode();
  const confirmEmail = useConfirmEmail();

  // UI state
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '' });
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [forecastOpen, setForecastOpen] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const telegramUsername = telegramSettings?.username ?? null;
  const userEmail = profile?.email ?? null;
  const emailVerified = profile?.email_verified === 1;

  const updateCooldown = useCallback(() => {
    const lastSent = localStorage.getItem(RESEND_STORAGE_KEY);
    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent, 10);
      const remaining = Math.max(0, RESEND_COOLDOWN_MS - elapsed);
      setResendCooldown(Math.ceil(remaining / 1000));
    } else {
      setResendCooldown(0);
    }
  }, []);

  useEffect(() => {
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [updateCooldown]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate(formData, {
      onSuccess: () => {
        setEditing(false);
        notifications.show({
          title: String(t('common.success')),
          message: String(t('profile.profileUpdated')),
          color: 'green',
        });
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('profile.profileUpdateError')),
          color: 'red',
        });
      },
    });
  };

  const openTelegramModal = () => {
    setTelegramInput(telegramUsername || '');
    setTelegramModalOpen(true);
  };

  const handleSaveTelegram = () => {
    updateTelegram.mutate(
      { username: telegramInput.trim().replace('@', '') },
      {
        onSuccess: () => {
          setTelegramModalOpen(false);
          notifications.show({
            title: String(t('common.success')),
            message: String(t('profile.telegramSaved')),
            color: 'green',
          });
        },
        onError: () => {
          notifications.show({
            title: String(t('common.error')),
            message: String(t('profile.telegramSaveError')),
            color: 'red',
          });
        },
      }
    );
  };

  const openEmailModal = () => {
    setEmailInput(userEmail || '');
    setEmailModalOpen(true);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getEmailErrorMessage = (serverMsg: string): string => {
    const errorMap: Record<string, string> = {
      'is not email': String(t('profile.invalidEmail')),
      'Email mismatch. Use the email shown in your profile.': String(t('profile.emailMismatch')),
      'Invalid code': String(t('profile.invalidCode')),
      'Code expired': String(t('profile.codeExpired')),
    };
    return errorMap[serverMsg] || serverMsg;
  };

  const handleSaveEmail = () => {
    const email = emailInput.trim();

    if (!isValidEmail(email)) {
      notifications.show({
        title: String(t('common.error')),
        message: String(t('profile.invalidEmail')),
        color: 'red',
      });
      return;
    }

    setEmail.mutate(email, {
      onSuccess: (response) => {
        const data = response.data;
        if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Successful') {
          notifications.show({
            title: String(t('common.error')),
            message: getEmailErrorMessage(data[0].msg),
            color: 'red',
          });
          return;
        }
        setEmailModalOpen(false);
        notifications.show({
          title: String(t('common.success')),
          message: String(t('profile.emailSaved')),
          color: 'green',
        });
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('profile.emailSaveError')),
          color: 'red',
        });
      },
    });
  };

  const handleSendVerifyCode = () => {
    if (!userEmail) return;
    if (resendCooldown > 0) return;

    sendVerifyCode.mutate(userEmail, {
      onSuccess: (response) => {
        const data = response.data;
        if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Verification code sent') {
          notifications.show({
            title: String(t('common.error')),
            message: getEmailErrorMessage(data[0].msg),
            color: 'red',
          });
          return;
        }

        localStorage.setItem(RESEND_STORAGE_KEY, Date.now().toString());
        updateCooldown();

        setVerifyModalOpen(true);
        setVerifyCode('');
        notifications.show({
          title: String(t('common.success')),
          message: String(t('profile.verifyCodeSent')),
          color: 'green',
        });
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('profile.verifyCodeError')),
          color: 'red',
        });
      },
    });
  };

  const handleConfirmEmail = () => {
    if (!verifyCode.trim()) return;

    confirmEmail.mutate(verifyCode.trim(), {
      onSuccess: (response) => {
        const data = response.data;
        if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Email verified successfully') {
          notifications.show({
            title: String(t('common.error')),
            message: getEmailErrorMessage(data[0].msg),
            color: 'red',
          });
          return;
        }

        setVerifyModalOpen(false);
        notifications.show({
          title: String(t('common.success')),
          message: String(t('profile.emailVerifiedSuccess')),
          color: 'green',
        });
      },
      onError: () => {
        notifications.show({
          title: String(t('common.error')),
          message: String(t('profile.emailVerifyError')),
          color: 'red',
        });
      },
    });
  };

  if (profileLoading || !profile) {
    return (
      <Center h="50vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>{t('profile.title')}</Title>

      <Card withBorder radius="md" p="lg">
        <Group>
          <Avatar
            size={80}
            radius="xl"
            color="blue"
            src={telegramPhoto || undefined}
          >
            {!telegramPhoto && (profile.full_name?.charAt(0) || profile.login?.charAt(0)?.toUpperCase() || '?')}
          </Avatar>
          <div>
            <Text fw={500} size="lg">{profile.full_name || profile.login || t('profile.user')}</Text>
            <Text size="sm" c="dimmed">ID: {profile.user_id} - {profile.login || '-'}</Text>
          </div>
        </Group>
      </Card>

      {forecast && forecast.items && forecast.items.length > 0 && (
        <Card withBorder radius="md" p="lg">
          <Group
            justify="space-between"
            style={{ cursor: 'pointer' }}
            onClick={() => setForecastOpen(!forecastOpen)}
          >
            <div>
              <Text fw={500}>{t('profile.forecast')}</Text>
              <Text size="sm" c={forecast.total > 0 ? 'red' : 'green'} fw={600}>
                {t('profile.toPay')}: {forecast.total.toFixed(2)} {t('common.currency')}
              </Text>
            </div>
            {forecastOpen ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
          </Group>
          <Collapse in={forecastOpen}>
            <Stack gap="sm" mt="md">
              {(forecast.items as Array<{ name: string; months: number; qnt: number; total: number; status: string }>).map((item, index) => (
                <Card
                  key={index}
                  withBorder
                  radius="sm"
                  p="sm"
                  bg={item.status === 'NOT PAID'
                    ? (colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'red.0')
                    : undefined
                  }
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>{item.name}</Text>
                      <Text size="xs" c="dimmed">
                        {item.months} {t('common.months')} × {item.qnt} {t('common.pieces')}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c={item.status === 'NOT PAID' ? 'red' : 'green'}>
                        {item.total.toFixed(2)} {t('common.currency')}
                      </Text>
                      <Text size="xs" c={item.status === 'NOT PAID' ? 'red' : 'green'}>
                        {item.status === 'NOT PAID' ? t('profile.notPaid') : item.status}
                      </Text>
                    </div>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Collapse>
        </Card>
      )}

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" c="dimmed">{t('profile.balance')}</Text>
            <Group gap="xs" align="baseline">
              <IconWallet size={24} />
              <Text size="xl" fw={700}>{profile.balance?.toFixed(2) || '0.00'} {t('common.currency')}</Text>
            </Group>
            { profile.credit && profile.credit > 0 ? ( <Text size="xm" c="dimmed">{t('profile.credit')}: {profile.credit}</Text>) : undefined}
          </div>
          <Button leftSection={<IconCreditCard size={18} />} onClick={() => setPayModalOpen(true)}>
            {t('profile.topUp')}
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center">
          <div>
              <Text size="xm" c="dimmed">{t('profile.bonus')}: {profile.bonus}</Text>
          </div>
          <Button onClick={() => setPromoModalOpen(true)}>
            {t('profile.enterPromo')}
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Text fw={500}>{t('profile.personalData')}</Text>
          {!editing ? (
            <Button variant="light" size="xs" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
          ) : (
            <Group gap="xs">
              <Button variant="light" size="xs" color="gray" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="xs" onClick={handleSave}>
                {t('common.save')}
              </Button>
            </Group>
          )}
        </Group>

        <Stack gap="md">
          <TextInput
            label={t('profile.fullName')}
            leftSection={<IconUser size={16} />}
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            disabled={!editing}
          />
          <TextInput
            label={t('profile.phone')}
            leftSection={<IconPhone size={16} />}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={!editing}
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Email</Text>
          <Group gap="xs">
            {userEmail && !emailVerified && (
              <Button
                variant="light"
                size="xs"
                color="orange"
                onClick={handleSendVerifyCode}
                loading={sendVerifyCode.isPending}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `${t('profile.verify')} (${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')})`
                  : t('profile.verify')}
              </Button>
            )}
            <Button variant="light" size="xs" onClick={openEmailModal}>
              {userEmail ? t('profile.change') : t('profile.link')}
            </Button>
          </Group>
        </Group>
        <Group>
          <IconMail size={24} color={emailVerified ? '#22c55e' : '#666'} />
          {userEmail ? (
            <div>
              <Text size="sm">{userEmail}</Text>
              <Text size="xs" c={emailVerified ? 'green' : 'orange'}>
                {emailVerified ? t('profile.emailVerified') : t('profile.emailNotVerified')}
              </Text>
            </div>
          ) : (
            <Text size="sm" c="dimmed">{t('profile.emailNotLinked')}</Text>
          )}
        </Group>
        <Text size="xs" c="dimmed" mt="md">
          {t('profile.emailDescription')}
        </Text>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Text fw={500}>{t('profile.telegram')}</Text>
          <Button variant="light" size="xs" onClick={openTelegramModal}>
            {telegramUsername ? t('profile.change') : t('profile.link')}
          </Button>
        </Group>
        <Group>
          <IconBrandTelegram size={24} color="#0088cc" />
          {telegramUsername ? (
            <div>
              <Text size="sm">@{telegramUsername}</Text>
              <Text size="xs" c="dimmed">{t('profile.telegramLinked')}</Text>
            </div>
          ) : (
            <Text size="sm" c="dimmed">{t('profile.telegramNotLinked')}</Text>
          )}
        </Group>
          <Text size="xs" c="dimmed" mt="md">
            {t('profile.telegramDescription')}
          </Text>
      </Card>

      <SecuritySettings />

      <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} />

      <PromoModal
        opened={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        onSuccess={refetchProfile}
      />

      <Modal
        opened={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        title={t('profile.linkTelegram')}
      >
        <Stack gap="md">
          <TextInput
            label={t('profile.telegramLogin')}
            placeholder="@username"
            value={telegramInput}
            onChange={(e) => setTelegramInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTelegram()}
          />
          <Text size="xs" c="dimmed">
            {t('profile.telegramLoginHint')}
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setTelegramModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveTelegram} loading={updateTelegram.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={t('profile.linkEmail')}
      >
        <Stack gap="md">
          {profile && isValidEmail(profile.login) && (
            <Alert variant="light" color="orange" icon={<IconAlertCircle size={16} />}>
              {t('profile.emailLoginWarning')}
            </Alert>
          )}
          <TextInput
            label={t('profile.emailAddress')}
            placeholder="example@email.com"
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
          />
          <Text size="xs" c="dimmed">
            {t('profile.emailHint')}
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setEmailModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveEmail} loading={setEmail.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title={t('profile.verifyEmail')}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('profile.verifyEmailDescription', { email: userEmail })}
          </Text>
          <TextInput
            label={t('profile.verifyCode')}
            placeholder="123456"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmEmail()}
            maxLength={6}
          />
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="xs"
              onClick={handleSendVerifyCode}
              loading={sendVerifyCode.isPending}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `${t('profile.resendCode')} (${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')})`
                : t('profile.resendCode')}
            </Button>
            <Group gap="xs">
              <Button variant="light" onClick={() => setVerifyModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleConfirmEmail} loading={confirmEmail.isPending}>
                {t('profile.confirmEmail')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}