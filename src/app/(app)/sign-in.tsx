import { useState } from 'react';

import { Button, Field, Notice, Screen } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'sign_in' | 'sign_up' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

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
        Barry tells the people you choose when you don’t check in from an Adventure.
      </ThemedText>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {confirmEmail && <Notice>Confirm your email address with the link Supabase sent you, then sign in.</Notice>}
      <Button title="Sign in" onPress={() => submit('sign_in')} busy={busy === 'sign_in'} disabled={!email || !password} />
      <Button
        title="Create account"
        kind="secondary"
        onPress={() => submit('sign_up')}
        busy={busy === 'sign_up'}
        disabled={!email || !password}
      />
    </Screen>
  );
}
