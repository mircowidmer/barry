import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Button, Field, Notice, Screen } from '@/components/form';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'sign_in' | 'sign_up' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const t = useTexts();

  // The confirmation page's button opens barry://sign-in, so the hint to confirm is done by then.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', () => setConfirmEmail(false));
    return () => subscription.remove();
  }, []);

  const submit = async (mode: 'sign_in' | 'sign_up') => {
    setBusy(mode);
    setError(null);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      mode === 'sign_in'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(null);
    if (error) setError(error.message);
    else if (!data.session) setConfirmEmail(true);
  };

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
      {error && <Notice tone="danger">{error}</Notice>}
      {confirmEmail && <Notice>{t.signIn.confirmEmail}</Notice>}
      <Button title={t.signIn.signIn} onPress={() => void submit('sign_in')} busy={busy === 'sign_in'} disabled={!email || !password} />
      <Button
        title={t.signIn.createAccount}
        kind="secondary"
        onPress={() => void submit('sign_up')}
        busy={busy === 'sign_up'}
        disabled={!email || !password}
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

const styles = StyleSheet.create({
  logo: { width: 96, height: 96, borderRadius: 22, alignSelf: 'center' },
  // Padding brings the 20-point text up to the 44-point hit target iOS asks for.
  link: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: Spacing.two },
});
