import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';

import { useCaptcha } from '@/components/captcha';
import { Button, Field, Screen } from '@/components/form';
import { Note } from '@/components/grouped-list';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createSignIn, type Credentials, RESEND_AFTER_SECONDS } from '@/lib/sign-in';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

const signIn = createSignIn(supabase.auth);

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'sign_in' | 'sign_up' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set while the address waits for its confirmation link; justSent when this screen just sent one.
  const [waiting, setWaiting] = useState<{ justSent: boolean } | null>(null);
  const captcha = useCaptcha();
  const t = useTexts();

  const submit = async (mode: 'sign_in' | 'sign_up') => {
    setBusy(mode);
    setError(null);
    const credentials = { email, password };
    const outcome = mode === 'sign_in' ? await signIn.signIn(credentials, captcha.token) : await signIn.signUp(credentials, captcha.token);
    setBusy(null);
    captcha.renew();
    if (outcome.kind === 'failed') setError(outcome.message);
    else if (outcome.kind === 'unconfirmed') setWaiting({ justSent: mode === 'sign_up' });
  };

  if (waiting) return <CheckInbox credentials={{ email, password }} justSent={waiting.justSent} onBack={() => setWaiting(null)} />;

  return (
    <Screen title="Barry">
      <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
      <ThemedText themeColor="textSecondary">
        {t.signIn.intro}
      </ThemedText>
      <Field
        label={t.signIn.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label={t.signIn.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />
      {captcha.widget}
      {error && <Note tone="danger">{error}</Note>}
      <Button
        title={t.signIn.signIn}
        onPress={() => void submit('sign_in')}
        busy={busy === 'sign_in'}
        disabled={!email || !password || !captcha.ready}
      />
      <Button
        title={t.signIn.createAccount}
        kind="secondary"
        onPress={() => void submit('sign_up')}
        busy={busy === 'sign_up'}
        disabled={!email || !password || !captcha.ready}
      />
      <ThemedText
        type="small"
        themeColor="accent"
        accessibilityRole="link"
        style={styles.link}
        onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}>
        {t.signIn.forgotPassword}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.legal.accept} {t.legal.notEmergency}
      </ThemedText>
      <LegalLinks />
    </Screen>
  );
}

/**
 * After Create Account, until the address is confirmed. The password stays in memory only, so the screen signs the
 * Adventurer in by itself each time Barry comes back from the confirmation link.
 */
function CheckInbox({ credentials, justSent, onBack }: { credentials: Credentials; justSent: boolean; onBack: () => void }) {
  const [busy, setBusy] = useState<'sign_in' | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(justSent ? RESEND_AFTER_SECONDS : 0);
  const [resent, setResent] = useState(false);
  const signInOnToken = useRef(false);
  const t = useTexts();
  const email = credentials.email.trim();

  // The try on each return to Barry stays quiet while the link is unopened; only a tap on Sign In says so.
  const confirm = async (token: string | undefined, quiet: boolean) => {
    setBusy('sign_in');
    setError(null);
    const outcome = await signIn.signIn(credentials, token);
    setBusy(null);
    if (outcome.kind === 'failed') setError(outcome.message);
    else if (outcome.kind === 'unconfirmed' && !quiet) setError(t.checkInbox.notConfirmed);
  };

  const captcha = useCaptcha((token, renew) => {
    if (!signInOnToken.current) return;
    signInOnToken.current = false;
    renew();
    void confirm(token, true);
  });

  const signInNow = () => {
    const token = captcha.token;
    captcha.renew();
    void confirm(token, false);
  };

  const resend = async () => {
    setBusy('resend');
    setError(null);
    const outcome = await signIn.resend(email, captcha.token);
    setBusy(null);
    captcha.renew();
    if (outcome.kind === 'failed') return setError(outcome.message);
    setSecondsLeft(RESEND_AFTER_SECONDS);
    setResent(true);
  };

  // A token from before the trip to the inbox may have expired, so the return asks for a fresh one and signs in with it.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || busy !== null) return;
      if (!captcha.required) return void confirm(undefined, true);
      signInOnToken.current = true;
      captcha.renew();
    });
    return () => subscription.remove();
  });

  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  return (
    <Screen title={t.checkInbox.title}>
      <Note tone="success" icon="envelope">
        {resent ? t.checkInbox.sentAgain(email) : t.checkInbox.sent(email)}
      </Note>
      {captcha.widget}
      {error && <Note tone="danger">{error}</Note>}
      <Button title={t.signIn.signIn} onPress={signInNow} busy={busy === 'sign_in'} disabled={busy !== null || !captcha.ready} />
      <Button
        title={counting ? t.checkInbox.sendAgainIn(secondsLeft) : t.checkInbox.sendAgain}
        kind="secondary"
        onPress={() => void resend()}
        busy={busy === 'resend'}
        disabled={busy !== null || counting || !captcha.ready}
      />
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" style={styles.link} onPress={onBack}>
        {t.checkInbox.otherAddress}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 96, height: 96, borderRadius: 22, alignSelf: 'center' },
  // Padding brings the 20-point text up to the 44-point hit target iOS asks for.
  link: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: Spacing.two },
});
