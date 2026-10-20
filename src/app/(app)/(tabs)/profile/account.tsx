import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { FirstLoad, LoadState, Notice, Screen } from '@/components/form';
import { ActionRow, Group, InputRow, ValueRow } from '@/components/grouped-list';
import { useLoad } from '@/hooks/use-load';
import { type AccountEmail, createAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

const account = createAccount(supabase.auth);

export default function AccountScreen() {
  const loaded = useLoad(() => account.email());
  const t = useTexts();
  const failure = (e: Error) => t.common.couldNotReach(e.message);
  if (loaded.data === undefined) {
    return (
      <Screen>
        <Close />
        <FirstLoad failure={loaded.error && failure(loaded.error)} onRetry={loaded.reload} />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={loaded.reload}>
      <Close />
      <LoadState loaded={loaded} failure={failure} />
      <PasswordChange email={loaded.data.email} />
      <EmailChange stored={loaded.data} onRequested={loaded.reload} />
    </Screen>
  );
}

function Close() {
  const t = useTexts();
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.done} onPress={() => router.back()} />
    </Stack.Toolbar>
  );
}

// whileEmail: a notice about a requested change is done once the stored address is no longer the one it was requested from.
type Shown = { tone: 'success' | 'danger'; text: string; whileEmail?: string } | null;

function PasswordChange({ email }: { email: string }) {
  const t = useTexts();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown>(null);

  const change = async () => {
    setBusy(true);
    setShown(null);
    const outcome = await account.changePassword(email, current, next);
    setBusy(false);
    if (outcome.kind === 'changed') {
      setCurrent('');
      setNext('');
      setShown({ tone: 'success', text: t.account.passwordChanged });
    } else {
      setShown({ tone: 'danger', text: outcome.kind === 'wrong_password' ? t.account.wrongPassword : outcome.message });
    }
  };

  return (
    <>
      <Group title={t.account.password} footer={t.account.passwordHint}>
        <InputRow
          label={t.account.currentPassword}
          value={current}
          placeholder={t.profile.required}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
        <InputRow
          label={t.account.newPassword}
          value={next}
          placeholder={t.profile.required}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <ActionRow title={t.account.changePassword} onPress={change} busy={busy} disabled={current === '' || next === ''} />
      </Group>
      {shown && <Notice tone={shown.tone}>{shown.text}</Notice>}
    </>
  );
}

function EmailChange({ stored, onRequested }: { stored: AccountEmail; onRequested: () => Promise<void> }) {
  const t = useTexts();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  const address = next.trim().toLowerCase();
  const unchanged = address === '' || address === stored.email.toLowerCase();
  const notice = shown && (shown.whileEmail === undefined || shown.whileEmail === stored.email) ? shown : null;

  const change = async () => {
    setBusy(true);
    setShown(null);
    const outcome = await account.changeEmail(stored.email, address);
    setBusy(false);
    if (outcome.kind === 'confirmation_sent') {
      setNext('');
      setShown({ tone: 'success', text: t.account.confirmationSent(outcome.from, outcome.to), whileEmail: stored.email });
      await onRequested();
    } else {
      setShown({ tone: 'danger', text: outcome.message });
    }
  };

  return (
    <>
      <Group title={t.account.email} footer={t.account.emailHint}>
        <ValueRow label={t.account.currentEmail} value={stored.email} />
        <InputRow
          label={t.account.newEmail}
          value={next}
          placeholder={t.profile.required}
          onChangeText={setNext}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <ActionRow title={t.account.changeEmail} onPress={change} busy={busy} disabled={unchanged} />
      </Group>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {!notice && stored.pendingEmail && <Notice>{t.account.pendingEmail(stored.pendingEmail)}</Notice>}
    </>
  );
}
