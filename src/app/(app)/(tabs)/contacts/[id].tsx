import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { FirstLoad, Screen } from '@/components/form';
import { ActionRow, Group, SwitchRow, ValueRow } from '@/components/grouped-list';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { useStringParam } from '@/hooks/use-string-param';
import { barry, type EmergencyContact, type EmergencyContactId } from '@/lib/barry';
import { formatPhoneNumber } from '@/lib/phone';
import { askToRemoveContact } from '@/lib/remove-contact';
import { useTexts } from '@/lib/texts';

type Switches = { emailEnabled: boolean; phoneEnabled: boolean };

const same = (a: Switches, b: Switches) => a.emailEnabled === b.emailEnabled && a.phoneEnabled === b.phoneEnabled;

/** The sheet of one contact: what was copied from the Phone Contact, the switches of its addresses, and Delete. */
export default function ContactSheet() {
  const id = useStringParam<EmergencyContactId>('id');
  const loaded = useLoad(async () => (await barry.listContacts()).find((c) => c.id === id) ?? null);
  const t = useTexts();

  if (loaded.data) return <ContactSwitches contact={loaded.data} />;
  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
      </Stack.Toolbar>
      <FirstLoad failure={loaded.status === 'loading' ? undefined : t.contacts.couldNotLoad} onRetry={() => void loaded.reload()} />
    </Screen>
  );
}

function ContactSwitches({ contact }: { contact: EmergencyContact }) {
  const t = useTexts();
  const [initial] = useState<Switches>({ emailEnabled: contact.emailEnabled, phoneEnabled: contact.phoneEnabled });
  const [switches, setSwitches] = useState<Switches>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const leave = useDiscardGuard(!same(switches, initial));

  const emailOn = contact.email !== null && switches.emailEnabled;
  const phoneOn = contact.phone !== null && switches.phoneEnabled;
  const complete = emailOn || phoneOn;

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      await barry.saveContact({ ...contact, emailEnabled: emailOn, phoneEnabled: phoneOn });
      leave();
    } catch {
      setBusy(null);
      setError(t.contacts.couldNotSave);
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    const outcome = await askToRemoveContact(contact);
    setBusy(null);
    if (outcome.kind === 'removed') leave();
    else if (outcome.kind === 'in_use') Alert.alert(t.contacts.inUse(contact.name));
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, t.contacts.couldNotDelete(contact.name));
  };

  return (
    <>
      <Stack.Screen options={{ title: contact.name }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} disabled={busy !== null} onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="done"
          icon="checkmark"
          accessibilityLabel={t.common.save}
          disabled={!complete || busy !== null}
          onPress={() => void save()}
        />
      </Stack.Toolbar>
      <Screen>
        <Group footer={t.contacts.copiedHint}>
          <ValueRow label={t.contacts.name} value={contact.name} />
        </Group>
        <Group title={t.contacts.emailSection}>
          <ValueRow label={t.contacts.address} value={contact.email ?? ''} />
          <SwitchRow
            label={t.contacts.useForMessages}
            accessibilityLabel={t.common.useLabel(t.contacts.email)}
            value={emailOn}
            disabled={contact.email === null}
            onValueChange={(emailEnabled) => setSwitches((s) => ({ ...s, emailEnabled }))}
          />
        </Group>
        <Group
          title={t.contacts.textSection}
          footer={error ?? t.contacts.switchesHint}
          footerTone={error ? 'danger' : undefined}>
          <ValueRow label={t.contacts.number} value={contact.phone ? formatPhoneNumber(contact.phone) : ''} mono />
          <SwitchRow
            label={t.contacts.useForMessages}
            accessibilityLabel={t.common.useLabel(t.contacts.phone)}
            value={phoneOn}
            disabled={contact.phone === null}
            onValueChange={(phoneEnabled) => setSwitches((s) => ({ ...s, phoneEnabled }))}
          />
        </Group>
        <Group>
          <ActionRow title={t.contacts.deleteContact} tone="danger" centered onPress={() => void remove()} busy={busy === 'delete'} />
        </Group>
      </Screen>
    </>
  );
}
