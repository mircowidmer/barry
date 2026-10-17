import { useState } from 'react';

import { Button, Field, Notice, Screen } from '@/components/form';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'sign_in' | 'sign_up' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const t = useTexts();

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
      <Button title={t.signIn.signIn} onPress={() => submit('sign_in')} busy={busy === 'sign_in'} disabled={!email || !password} />
      <Button
        title={t.signIn.createAccount}
        kind="secondary"
        onPress={() => submit('sign_up')}
        busy={busy === 'sign_up'}
        disabled={!email || !password}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {t.legal.accept} {t.legal.notEmergency}
      </ThemedText>
      <LegalLinks />
    </Screen>
  );
}
