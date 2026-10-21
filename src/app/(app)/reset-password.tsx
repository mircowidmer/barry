import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Field, Notice, Screen } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useStringParam } from '@/hooks/use-string-param';
import { createPasswordReset } from '@/lib/password-reset';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

const passwordReset = createPasswordReset(supabase.auth);

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState(useStringParam('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'send' | 'set' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTexts();

  const sendCode = async () => {
    setBusy('send');
    setError(null);
    const outcome = await passwordReset.requestCode(email);
    setBusy(null);
    if (outcome.kind === 'failed') setError(outcome.message);
    else setSent(true);
  };

  // The code signs the Adventurer in, so the tabs are reachable once the new password is saved.
  const setNewPassword = async () => {
    setBusy('set');
    setError(null);
    const outcome = await passwordReset.setPassword({ email, code, password });
    if (outcome.kind === 'failed') {
      setBusy(null);
      setError(outcome.message);
      return;
    }
    router.replace('/');
  };

  return (
    <Screen title={t.resetPassword.title}>
      <ThemedText themeColor="textSecondary">{t.resetPassword.intro}</ThemedText>
      {sent ? (
        <>
          <Notice>{t.resetPassword.codeSent(email.trim())}</Notice>
          <Field
            label={t.resetPassword.code}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <Field
            label={t.resetPassword.newPassword}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={t.resetPassword.setPassword} onPress={setNewPassword} busy={busy === 'set'} disabled={!code || !password} />
          <Button title={t.resetPassword.sendAgain} kind="secondary" onPress={sendCode} busy={busy === 'send'} disabled={busy === 'set'} />
        </>
      ) : (
        <>
          <Field
            label={t.signIn.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={t.resetPassword.sendCode} onPress={sendCode} busy={busy === 'send'} disabled={!email.trim()} />
        </>
      )}
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" style={styles.link} onPress={() => router.back()}>
        {t.resetPassword.backToSignIn}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Padding brings the 20-point text up to the 44-point hit target iOS asks for.
  link: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: Spacing.two },
});
