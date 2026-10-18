import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { barry, type EmergencyContact, type EmergencyContactId, isEmailAddress, isPhoneNumber } from '@/lib/barry';
import { formatPhoneNumber, phoneInput } from '@/lib/phone';
import { askToRemoveContact } from '@/lib/remove-contact';
import { useTexts } from '@/lib/texts';

type Form = { id?: EmergencyContactId; name: string; email: string; emailEnabled: boolean; phone: string; phoneEnabled: boolean };

const blank: Form = { name: '', email: '', emailEnabled: true, phone: '', phoneEnabled: true };

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const emailOn = (form: Form) => form.emailEnabled && isEmailAddress(form.email);
const phoneOn = (form: Form) => form.phoneEnabled && isPhoneNumber(form.phone);

export default function ContactsScreen() {
  const loaded = useLoad(async () => {
    const [contacts, channels] = await Promise.all([barry.listContacts(), barry.enabledChannels()]);
    return { contacts, smsEnabled: channels.has('sms') };
  });
  const [draft, setDraft] = useState<Form>(blank);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useTexts();

  const edit = (contact: EmergencyContact) => {
    setDraft({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? '',
      emailEnabled: contact.emailEnabled,
      phone: contact.phone ? formatPhoneNumber(contact.phone) : '',
      phoneEnabled: contact.phoneEnabled,
    });
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await barry.saveContact({
        id: draft.id,
        name: draft.name.trim(),
        email: orNull(draft.email),
        emailEnabled: emailOn(draft),
        phone: orNull(draft.phone.replace(/\s/g, '')),
        phoneEnabled: phoneOn(draft),
      });
      setMessage({ tone: 'success', text: t.contacts.saved(draft.name.trim()) });
      setDraft(blank);
      loaded.reload();
    } catch {
      setMessage({
        tone: 'danger',
        text: t.contacts.couldNotSave,
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (contact: EmergencyContact) => {
    const outcome = await askToRemoveContact(contact);
    if (outcome.kind === 'cancelled') return;
    setMessage(
      outcome.kind === 'removed'
        ? { tone: 'success', text: t.contacts.deleted(contact.name) }
        : outcome.kind === 'in_use'
          ? { tone: 'danger', text: t.contacts.inUse(contact.name) }
          : { tone: 'danger', text: t.contacts.couldNotDelete(contact.name) },
    );
    if (draft.id === contact.id) setDraft(blank);
    loaded.reload();
  };

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">{t.contacts.intro}</ThemedText>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {loaded.status === 'error' && <Notice tone="danger">{t.contacts.couldNotLoad}</Notice>}
      {loaded.data?.contacts.map((contact) => (
        <Section key={contact.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.contacts.editLabel(contact.name)} onPress={() => edit(contact)}>
            <ThemedText type="smallBold">{contact.name}</ThemedText>
            {contact.email && (
              <ThemedText type="small" themeColor={contact.emailEnabled ? undefined : 'textSecondary'}>
                {contact.email}
                {!contact.emailEnabled && `  ·  ${t.contacts.off}`}
              </ThemedText>
            )}
            {contact.phone && (
              <ThemedText type="small" themeColor={contact.phoneEnabled ? undefined : 'textSecondary'}>
                {formatPhoneNumber(contact.phone)}
                {!contact.phoneEnabled ? `  ·  ${t.contacts.off}` : !loaded.data.smsEnabled && `  ·  ${t.contacts.smsNotSetUp}`}
              </ThemedText>
            )}
          </Pressable>
          <Row>
            <Button title={t.contacts.edit} kind="secondary" onPress={() => edit(contact)} />
            <Button title={t.common.delete} kind="danger" onPress={() => remove(contact)} />
          </Row>
        </Section>
      ))}
      <Section title={draft.id ? t.contacts.editTitle(draft.name) : t.contacts.add}>
        <Field label={t.contacts.name} value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} />
        <Field
          label={t.contacts.email}
          value={draft.email}
          toggle={{
            value: emailOn(draft),
            disabled: !isEmailAddress(draft.email),
            onValueChange: (emailEnabled) => setDraft((d) => ({ ...d, emailEnabled })),
          }}
          onChangeText={(email) => setDraft((d) => ({ ...d, email }))}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label={t.contacts.phone}
          value={draft.phone}
          toggle={{
            value: phoneOn(draft),
            disabled: !isPhoneNumber(draft.phone),
            onValueChange: (phoneEnabled) => setDraft((d) => ({ ...d, phoneEnabled })),
          }}
          onChangeText={(phone) => setDraft((d) => ({ ...d, phone: phoneInput(phone) }))}
          keyboardType="phone-pad"
          hint={t.contacts.phoneHint}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t.contacts.switchesHint}
        </ThemedText>
        <Row>
          <Button
            title={draft.id ? t.common.save : t.contacts.addButton}
            onPress={save}
            busy={saving}
            disabled={draft.name.trim() === '' || !(emailOn(draft) || phoneOn(draft))}
          />
          {draft.id && <Button title={t.common.cancel} kind="secondary" onPress={() => setDraft(blank)} />}
        </Row>
      </Section>
    </Screen>
  );
}
