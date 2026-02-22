import { useEffect, useRef, useState } from 'react';
import { Card, Text, Stack, Button, TextInput, PasswordInput, Divider, Title, Center, Modal, Group, Loader } from '@mantine/core';
import { IconLogin, IconUserPlus, IconFingerprint, IconShieldLock, IconBrandTelegram, IconMailForward, IconLock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { getResetTokenCookie, removeResetTokenCookie, parseAndSaveResetToken } from '../api/cookie';
import { useStore } from '../store/useStore';
import TelegramLoginButton, { TelegramUser } from '../components/TelegramLoginButton';
import { config } from '../config';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { hasTelegramWebAppAutoAuth, hasTelegramWidget, hasTelegramWebAppAuth } from '../constants/webapp';
import {
  useLogin,
  useRegister,
  useCurrentUser,
  useTelegramWidgetAuth,
  useTelegramWebAppAuth,
  usePasskeyAuthOptions,
  usePasskeyAuth,
  useVerifyResetToken,
  useResetPasswordWithToken,
  useResetPasswordRequest,
} from '../api/hooks';

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [formData, setFormData] = useState({ login: '', password: '', confirmPassword: '', login_or_email: '' });
  const [showOtp, setShowOtp] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPasswordData, setNewPasswordData] = useState({ password: '', confirmPassword: '' });
  const { setUser, setTelegramPhoto } = useStore();
  const { t } = useTranslation();
  const isWebAuthnSupported = !!window.PublicKeyCredential;

  // Auth hooks
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const telegramWidgetAuthMutation = useTelegramWidgetAuth();
  const telegramWebAppAuthMutation = useTelegramWebAppAuth();
  const { refetch: refetchCurrentUser } = useCurrentUser();

  // Passkey hooks
  const passkeyAuthOptionsMutation = usePasskeyAuthOptions();
  const passkeyAuthMutation = usePasskeyAuth();

  // Password reset hooks
  const resetPasswordRequestMutation = useResetPasswordRequest();
  const resetPasswordWithTokenMutation = useResetPasswordWithToken();
  const { data: resetTokenValidation, isLoading: isVerifyingToken } = useVerifyResetToken(resetToken);
  const { telegramWebApp } = useTelegramWebApp();
  const autoAuthTriggeredRef = useRef(false);
  const autoAuthAttemptKey = 'tg_webapp_auto_auth_attempted';
  const autoAuthCooldownMs = 60 * 1000;

  useEffect(() => {
    if (!hasTelegramWebAppAutoAuth || autoAuthTriggeredRef.current || !telegramWebApp?.initData) {
      return;
    }

    const lastAttempt = Number(sessionStorage.getItem(autoAuthAttemptKey) || 0);
    if (lastAttempt && Date.now() - lastAttempt < autoAuthCooldownMs) {
      return;
    }

    autoAuthTriggeredRef.current = true;
    sessionStorage.setItem(autoAuthAttemptKey, String(Date.now()));
    setShowLoginForm(false);
    void handleTelegramWebAppAuth();
  }, [hasTelegramWebAppAutoAuth, telegramWebApp?.initData]);

  // Check for reset token in URL or cookie on mount
  useEffect(() => {
    const urlToken = parseAndSaveResetToken();
    const token = urlToken || getResetTokenCookie();
    if (token) {
      setResetToken(token);
    }
  }, []);

  // Handle reset token validation result
  useEffect(() => {
    if (!resetToken || isVerifyingToken) return;

    if (resetTokenValidation?.isValid) {
      setShowNewPasswordForm(true);
    } else if (resetTokenValidation) {
      notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
      removeResetTokenCookie();
      setResetToken(null);
    }
  }, [resetToken, resetTokenValidation, isVerifyingToken, t]);

  const handleNewPasswordSubmit = async () => {
    if (!newPasswordData.password || !newPasswordData.confirmPassword) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }

    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      notifications.show({ title: t('common.error'), message: t('auth.passwordsMismatch'), color: 'red' });
      return;
    }

    if (!resetToken) {
      notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
      return;
    }

    setResetLoading(true);
    try {
      await resetPasswordWithTokenMutation.mutateAsync({ token: resetToken, password: newPasswordData.password });
      notifications.show({ title: t('common.success'), message: t('auth.passwordResetSuccess'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
    } finally {
      removeResetTokenCookie();
      setResetToken(null);
      setShowNewPasswordForm(false);
      setNewPasswordData({ password: '', confirmPassword: '' });
      setResetLoading(false);
    }
  };

  const handleLogin = async (otpTokenParam?: string) => {
    if (!formData.login || !formData.password) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }

    setLoading(true);
    try {
      const result = await loginMutation.mutateAsync({
        login: formData.login,
        password: formData.password,
        otp_token: otpTokenParam,
      });

      if (result.otpRequired) {
        setShowOtp(true);
        setLoading(false);
        return;
      }

      const { data: userData } = await refetchCurrentUser();
      if (userData) {
        setUser(userData);
      }
      setShowOtp(false);
      setOtpToken('');
      notifications.show({ title: t('common.success'), message: t('auth.loginSuccess'), color: 'green' });
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 403 && axiosError.response?.data?.error?.includes('Password authentication is disabled')) {
        notifications.show({ title: t('common.error'), message: t('auth.passwordAuthDisabled'), color: 'red' });
      } else {
        notifications.show({ title: t('common.error'), message: t('auth.loginError'), color: 'red' });
      }
      setOtpToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpToken) {
      notifications.show({ title: t('common.error'), message: t('otp.enterValidCode'), color: 'red' });
      return;
    }
    await handleLogin(otpToken);
  };

  const handleRegister = async () => {
    if (!formData.login || !formData.password) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      notifications.show({ title: t('common.error'), message: t('auth.passwordsMismatch'), color: 'red' });
      return;
    }

    setLoading(true);
    try {
      await registerMutation.mutateAsync({ login: formData.login, password: formData.password });
      notifications.show({ title: t('common.success'), message: t('auth.registerSuccess'), color: 'green' });
      setMode('login');
      setFormData({ ...formData, confirmPassword: '' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.registerError'), color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  const handleTelegramWidgetAuth = async (telegramUser: TelegramUser) => {
    setLoading(true);
    try {
      await telegramWidgetAuthMutation.mutateAsync(telegramUser);
      const { data: userData } = await refetchCurrentUser();
      if (userData) {
        setUser(userData);
      }

      if (telegramUser.photo_url) {
        setTelegramPhoto(telegramUser.photo_url);
      }

      notifications.show({ title: t('common.success'), message: t('auth.telegramAuth'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramWebAppAuth = async () => {
    if (!telegramWebApp?.initData) {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
      setShowLoginForm(true);
      return;
    }

    setLoading(true);
    try {
      const profile = config.TELEGRAM_WEBAPP_PROFILE || '';

      const result = await telegramWebAppAuthMutation.mutateAsync({ initData: telegramWebApp.initData, profile });
      if (!result.sessionId) {
        notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
        setShowLoginForm(true);
        return;
      }

      const { data: userData } = await refetchCurrentUser();
      if (userData) {
        setUser(userData);
      }

      if (telegramWebApp.initDataUnsafe?.user?.photo_url) {
        setTelegramPhoto(telegramWebApp.initDataUnsafe.user.photo_url);
      }

      notifications.show({ title: t('common.success'), message: t('auth.telegramAuth'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
      setShowLoginForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.login_or_email) {
      notifications.show({ title: t('common.error'), message: t('auth.resetEnterLogin'), color: 'red' });
      return;
    }

    setResetLoading(true);
    try {
      // Try by login first
      await resetPasswordRequestMutation.mutateAsync({ login: formData.login_or_email });
      notifications.show({ title: t('common.success'), message: t('auth.resetSuccess'), color: 'green' });
      setShowResetPassword(false);
    } catch {
      // If login fails, try by email
      try {
        await resetPasswordRequestMutation.mutateAsync({ email: formData.login_or_email });
        notifications.show({ title: t('common.success'), message: t('auth.resetSuccess'), color: 'green' });
        setShowResetPassword(false);
      } catch {
        notifications.show({ title: t('common.error'), message: t('auth.resetNotFound'), color: 'red' });
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasskeyAuth = async () => {
    if (!isWebAuthnSupported) {
      notifications.show({ title: t('common.error'), message: t('passkey.notSupported'), color: 'red' });
      return;
    }

    setPasskeyLoading(true);
    try {
      const options = await passkeyAuthOptionsMutation.mutateAsync();
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToArrayBuffer(options.challenge),
        timeout: options.timeout,
        rpId: options.rpId,
        userVerification: options.userVerification as UserVerificationRequirement,
      };
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to get credential');
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      await passkeyAuthMutation.mutateAsync({
        credential_id: arrayBufferToBase64Url(credential.rawId),
        rawId: arrayBufferToBase64Url(credential.rawId),
        response: {
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
          signature: arrayBufferToBase64Url(response.signature),
          userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : undefined,
        },
      });

      const { data: userData } = await refetchCurrentUser();
      if (userData) {
        setUser(userData);
      }

      notifications.show({ title: t('common.success'), message: t('auth.loginSuccess'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('passkey.authError'), color: 'red' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Center h="80vh" style={{ position: 'relative' }}>
      <Card withBorder radius="md" p="xl" w={400}>
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <div style={{ flex: 1 }} />
            <Title order={2} ta="center" style={{ flex: 'auto' }}>{config.APP_NAME}</Title>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <LanguageSwitcher />
            </div>
          </Group>
          <Text size="sm" c="dimmed" ta="center">
              {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </Text>

          {hasTelegramWebAppAuth && !showLoginForm && (
            <>
              <Button
                color="blue"
                leftSection={<IconBrandTelegram size={18} />}
                onClick={handleTelegramWebAppAuth}
                fullWidth
                loading={loading}
              >
                {t('auth.loginWithTelegram')}
              </Button>

              <Divider label={t('common.or')} labelPosition="center" />

              <Button
                variant="light"
                onClick={() => setShowLoginForm(true)}
                fullWidth
              >
                {t('auth.useLoginPassword')}
              </Button>
            </>
          )}

          {hasTelegramWidget && (
            <>
              <Center>
                <TelegramLoginButton
                  botName={config.TELEGRAM_BOT_NAME}
                  onAuth={handleTelegramWidgetAuth}
                  buttonSize="large"
                  requestAccess="write"
                />
              </Center>

              <Divider label={t('common.or')} labelPosition="center" />
            </>
          )}

          {(!hasTelegramWebAppAuth || showLoginForm) && (
            <>
              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  <TextInput
                    label={t('auth.loginLabel')}
                    placeholder={t('auth.loginPlaceholder')}
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    autoComplete="username"
                    name="username"
                  />
                  <PasswordInput
                    label={t('auth.passwordLabel')}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    name="password"
                  />
                  {mode === 'register' && (
                    <PasswordInput
                      label={t('auth.confirmPasswordLabel')}
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      autoComplete="new-password"
                      name="confirm-password"
                    />
                  )}
                  <Button
                    type="submit"
                    leftSection={mode === 'login' ? <IconLogin size={18} /> : <IconUserPlus size={18} />}
                    loading={loading}
                  >
                    {mode === 'login' ? t('auth.login') : t('auth.register')}
                  </Button>
                  {mode === 'login' && isWebAuthnSupported && hasTelegramWidget && (
                    <Button
                      variant="light"
                      leftSection={<IconFingerprint size={18} />}
                      loading={passkeyLoading}
                      onClick={handlePasskeyAuth}
                    >
                      {t('passkey.loginWithPasskey')}
                    </Button>
                  )}
                </Stack>
              </form>

              <Text size="sm" ta="center">
                {mode === 'login' ? (
                  <>
                    {t('auth.noAccount')}{' '}
                    <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => setMode('register')}>
                      {t('auth.register')}
                    </Text>
                  </>
                ) : (
                  <>
                    {t('auth.hasAccount')}{' '}
                    <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => setMode('login')}>
                      {t('auth.login')}
                    </Text>
                  </>
                )}
              </Text>

              {mode === 'login' && (
                <Text size="sm" ta="center">
                  <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => setShowResetPassword(true)}>
                    {t('auth.forgotPassword')}
                  </Text>
                </Text>
              )}

              {hasTelegramWebAppAuth && showLoginForm && (
                <>
                  <Divider label={t('common.or')} labelPosition="center" />
                  <Button
                    variant="outline"
                    color="blue"
                    leftSection={<IconBrandTelegram size={18} />}
                    onClick={handleTelegramWebAppAuth}
                    fullWidth
                    loading={loading}
                  >
                    {t('auth.loginWithTelegram')}
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      </Card>

      <Modal
        opened={showOtp}
        onClose={() => {
          setShowOtp(false);
          setOtpToken('');
        }}
        title={
          <Group gap="xs">
            <IconShieldLock size={20} />
            <Text fw={500}>{t('otp.title')}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('otp.verifyDescription')}</Text>
          <TextInput
            label={t('otp.enterCode')}
            placeholder="000000"
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            autoFocus
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowOtp(false);
              setOtpToken('');
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOtpSubmit}
              loading={loading}
              disabled={!otpToken}
            >
              {t('otp.verify')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showResetPassword}
        onClose={() => {
          setShowResetPassword(false);
          setResetLoading(false);
        }}
        title={t('auth.resetPasswordTitle')}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('auth.resetPasswordDescription')}</Text>
          <TextInput
            label={t('auth.loginOrEmail')}
            placeholder={t('auth.loginOrEmailPlaceholder')}
            value={formData.login_or_email}
            onChange={(e) => setFormData({ ...formData, login_or_email: e.target.value })}
            autoFocus
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowResetPassword(false);
              setResetLoading(false);
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              leftSection={<IconMailForward size={16} />}
              onClick={handleResetPassword}
              loading={resetLoading}
              disabled={!formData.login_or_email}
            >
              {t('auth.resetPasswordSend')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showNewPasswordForm}
        onClose={() => {
          setShowNewPasswordForm(false);
          removeResetTokenCookie();
          setResetToken(null);
          setNewPasswordData({ password: '', confirmPassword: '' });
        }}
        title={
          <Group gap="xs">
            <IconLock size={20} />
            <Text fw={500}>{t('auth.newPasswordTitle')}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('auth.newPasswordDescription')}</Text>
          <PasswordInput
            label={t('auth.newPasswordLabel')}
            placeholder={t('auth.passwordPlaceholder')}
            value={newPasswordData.password}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, password: e.target.value })}
            autoFocus
          />
          <PasswordInput
            label={t('auth.confirmNewPasswordLabel')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={newPasswordData.confirmPassword}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, confirmPassword: e.target.value })}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowNewPasswordForm(false);
              removeResetTokenCookie();
              setResetToken(null);
              setNewPasswordData({ password: '', confirmPassword: '' });
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              leftSection={<IconLock size={16} />}
              onClick={handleNewPasswordSubmit}
              loading={resetLoading}
              disabled={!newPasswordData.password || !newPasswordData.confirmPassword}
            >
              {t('auth.resetPasswordButton')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {isVerifyingToken && (
        <Modal opened={true} onClose={() => {}} withCloseButton={false} centered>
          <Stack align="center" gap="md">
            <Loader />
            <Text>{t('auth.verifyingToken')}</Text>
          </Stack>
        </Modal>
      )}
    </Center>
  );
}