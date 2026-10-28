import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { useCaptcha } from '@/components/captcha';
import { FirstLoad, LoadState, Screen } from '@/components/form';
import { ActionRow, Group, InputRow, ValueRow } from '@/components/grouped-list';
import { useLoad } from '@/hooks/use-load';
import { type AccountEmail, createAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { useTexts } from '@/lib/texts';

const account = createAccount(supabase.auth);

export default function AccountScreen() {
  const loaded = useLoad(() => account.email());
  const t = useTexts();
  const [pulls, setPulls] = useState(0);
  const failure = () => t.common.couldNotReach;
  const pull = () => {
    setPulls((n) => n + 1);
    return loaded.reload();
  };
  if (loaded.data === undefined) {
    return (
      <Screen>
        <Close />
        <FirstLoad failure={loaded.error && failure()} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={pull}>
      <Close />
      <LoadState loaded={loaded} failure={failure} />
      <PasswordChange email={loaded.data.email} />
      <EmailChange stored={loaded.data} pulls={pulls} onRequested={loaded.reload} />
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
// atPull: the notice is done once the Adventurer pulls the sheet down, so the reload can show what is stored.
type Shown = { tone: 'success' | 'danger'; text: string; whileEmail?: string; atPull?: number } | null;

function PasswordChange({ email }: { email: string }) {
  const t = useTexts();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  const captcha = useCaptcha();

  const change = async () => {
    setBusy(true);
    setShown(null);
    const outcome = await account.changePassword(email, current, next, captcha.token);
    setBusy(false);
    captcha.renew();
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
      {/* A result replaces the hint under the group it belongs to, so it reads where the Adventurer just typed. */}
      <Group title={t.account.password} footer={shown?.text ?? t.account.passwordHint} footerTone={shown?.tone}>
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
        <ActionRow
          title={t.account.changePassword}
          onPress={() => void change()}
          busy={busy}
          disabled={current === '' || next === '' || !captcha.ready}
        />
      </Group>
      {captcha.widget}
    </>
  );
}

function EmailChange({
  stored,
  pulls,
  onRequested,
}: {
  stored: AccountEmail;
  pulls: number;
  onRequested: () => Promise<void>;
}) {
  const t = useTexts();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  const address = next.trim().toLowerCase();
  const unchanged = address === '' || address === stored.email.toLowerCase();
  const current = (s: NonNullable<Shown>) =>
    (s.whileEmail === undefined || s.whileEmail === stored.email) && (s.atPull === undefined || s.atPull === pulls);
  const notice = shown && current(shown) ? shown : null;

  const change = async () => {
    setBusy(true);
    setShown(null);
    const outcome = await account.changeEmail(stored.email, address);
    setBusy(false);
    if (outcome.kind === 'confirmation_sent') {
      setNext('');
      setShown({
        tone: 'success',
        text: t.account.confirmationSent(outcome.from, outcome.to),
        whileEmail: stored.email,
        atPull: pulls,
      });
      await onRequested();
    } else {
      setShown({ tone: 'danger', text: outcome.message, atPull: pulls });
    }
  };

  return (
    <>
      <Group
        title={t.account.email}
        footer={notice?.text ?? (stored.pendingEmail ? t.account.pendingEmail(stored.pendingEmail) : t.account.emailHint)}
        footerTone={notice?.tone ?? (stored.pendingEmail ? 'warning' : undefined)}
        footerIcon={!notice && stored.pendingEmail ? 'envelope' : undefined}>
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
        <ActionRow title={t.account.changeEmail} onPress={() => void change()} busy={busy} disabled={unchanged} />
      </Group>
    </>
  );
}
