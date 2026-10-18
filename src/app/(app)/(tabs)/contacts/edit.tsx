import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Loading, Notice, Screen } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { barry, type EmergencyContact, type EmergencyContactId, isEmailAddress, isPhoneNumber } from '@/lib/barry';
import { formatPhoneNumber, phoneInput } from '@/lib/phone';
import { askToRemoveContact } from '@/lib/remove-contact';
import { useTexts } from '@/lib/texts';

type Form = { name: string; email: string; emailEnabled: boolean; phone: string; phoneEnabled: boolean };

const blank: Form = { name: '', email: '', emailEnabled: true, phone: '', phoneEnabled: true };

const toForm = (contact: EmergencyContact): Form => ({
  name: contact.name,
  email: contact.email ?? '',
  emailEnabled: contact.emailEnabled,
  phone: contact.phone ? formatPhoneNumber(contact.phone) : '',
  phoneEnabled: contact.phoneEnabled,
});

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const emailOn = (form: Form) => form.emailEnabled && isEmailAddress(form.email);
const phoneOn = (form: Form) => form.phoneEnabled && isPhoneNumber(form.phone);

const same = (a: Form, b: Form) =>
  a.name === b.name && a.email === b.email && a.emailEnabled === b.emailEnabled && a.phone === b.phone && a.phoneEnabled === b.phoneEnabled;

/** The sheet that adds a contact, or edits the one named by the id. */
export default function ContactSheet() {
  const { id } = useLocalSearchParams<{ id?: EmergencyContactId }>();
  const loaded = useLoad(async () => (id ? ((await barry.listContacts()).find((c) => c.id === id) ?? null) : null));
  const t = useTexts();

  if (loaded.data !== undefined && (!id || loaded.data)) return <ContactForm contact={loaded.data} />;
  return (
    <Screen>
      <Stack.Screen options={{ title: id ? t.contacts.editTitle('') : t.contacts.newTitle }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
      </Stack.Toolbar>
      {loaded.status === 'loading' ? (
        <Loading />
      ) : (
        <>
          <Notice tone="danger">{t.contacts.couldNotLoad}</Notice>
          <Button title={t.common.tryAgain} kind="secondary" onPress={loaded.reload} />
        </>
      )}
    </Screen>
  );
}

function ContactForm({ contact }: { contact: EmergencyContact | null }) {
  const t = useTexts();
  const [initial] = useState<Form>(() => (contact ? toForm(contact) : blank));
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const leave = useDiscardGuard(!same(form, initial));

  // An address that is filled in but not valid would be saved switched off without a word, so it blocks Save.
  const wellFormed = (form.email.trim() === '' || isEmailAddress(form.email)) && (form.phone.trim() === '' || isPhoneNumber(form.phone));
  const complete = form.name.trim() !== '' && (emailOn(form) || phoneOn(form)) && wellFormed;

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      await barry.saveContact({
        id: contact?.id,
        name: form.name.trim(),
        email: orNull(form.email),
        emailEnabled: emailOn(form),
        phone: orNull(form.phone.replace(/\s/g, '')),
        phoneEnabled: phoneOn(form),
      });
      leave();
    } catch {
      setBusy(null);
      setError(t.contacts.couldNotSave);
    }
  };

  const remove = async () => {
    if (!contact) return;
    setBusy('delete');
    setError(null);
    const outcome = await askToRemoveContact(contact);
    setBusy(null);
    if (outcome.kind === 'removed') leave();
    else if (outcome.kind === 'in_use') setError(t.contacts.inUse(contact.name));
    else if (outcome.kind === 'failed') setError(t.contacts.couldNotDelete(contact.name));
  };

  return (
    <>
      <Stack.Screen options={{ title: contact ? t.contacts.editTitle(contact.name) : t.contacts.newTitle }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} disabled={busy !== null} onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="done"
          icon="checkmark"
          accessibilityLabel={contact ? t.common.save : t.common.add}
          disabled={!complete || busy !== null}
          onPress={save}
        />
      </Stack.Toolbar>
      <Screen>
        <Field label={t.contacts.name} value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} autoFocus={!contact} />
        <Field
          label={t.contacts.email}
          value={form.email}
          toggle={{
            value: emailOn(form),
            disabled: !isEmailAddress(form.email),
            onValueChange: (emailEnabled) => setForm((f) => ({ ...f, emailEnabled })),
          }}
          onChangeText={(email) => setForm((f) => ({ ...f, email }))}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label={t.contacts.phone}
          value={form.phone}
          toggle={{
            value: phoneOn(form),
            disabled: !isPhoneNumber(form.phone),
            onValueChange: (phoneEnabled) => setForm((f) => ({ ...f, phoneEnabled })),
          }}
          onChangeText={(phone) => setForm((f) => ({ ...f, phone: phoneInput(phone) }))}
          keyboardType="phone-pad"
          hint={t.contacts.phoneHint}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t.contacts.switchesHint}
        </ThemedText>
        {error && <Notice tone="danger">{error}</Notice>}
        {contact && <Button title={t.common.delete} kind="danger" onPress={remove} busy={busy === 'delete'} />}
      </Screen>
    </>
  );
}
