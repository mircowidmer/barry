import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { barry, type EmergencyContact, type EmergencyContactId, isEmailAddress, isPhoneNumber } from '@/lib/barry';
import { askToRemoveContact } from '@/lib/remove-contact';

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

  const edit = (contact: EmergencyContact) => {
    setDraft({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? '',
      emailEnabled: contact.emailEnabled,
      phone: contact.phone ?? '',
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
      setMessage({ tone: 'success', text: `${draft.name.trim()} saved.` });
      setDraft(blank);
      loaded.reload();
    } catch {
      setMessage({
        tone: 'danger',
        text: 'Could not save. A contact needs an email address or a phone number with country code that is switched on.',
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
        ? { tone: 'success', text: `${contact.name} deleted.` }
        : outcome.kind === 'in_use'
          ? { tone: 'danger', text: `${contact.name} is a contact of your current Adventure, so they stay until you check in.` }
          : { tone: 'danger', text: `Could not delete ${contact.name}. Try again.` },
    );
    if (draft.id === contact.id) setDraft(blank);
    loaded.reload();
  };

  return (
    <Screen title="Emergency Contacts">
      <ThemedText themeColor="textSecondary">
        Barry can tell these contacts when you start an adventure, and again if you don’t check in on time. They don’t need to use Barry.
      </ThemedText>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {loaded.status === 'error' && <Notice tone="danger">Could not load your contacts.</Notice>}
      {loaded.data?.contacts.map((contact) => (
        <Section key={contact.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${contact.name}`} onPress={() => edit(contact)}>
            <ThemedText type="smallBold">{contact.name}</ThemedText>
            {contact.email && (
              <ThemedText type="small" themeColor={contact.emailEnabled ? undefined : 'textSecondary'}>
                {contact.email}
                {!contact.emailEnabled && '  ·  Off'}
              </ThemedText>
            )}
            {contact.phone && (
              <ThemedText type="small" themeColor={contact.phoneEnabled ? undefined : 'textSecondary'}>
                {contact.phone}
                {!contact.phoneEnabled ? '  ·  Off' : !loaded.data.smsEnabled && '  ·  Text messages not set up yet'}
              </ThemedText>
            )}
          </Pressable>
          <Row>
            <Button title="Edit" kind="secondary" onPress={() => edit(contact)} />
            <Button title="Delete" kind="danger" onPress={() => remove(contact)} />
          </Row>
        </Section>
      ))}
      <Section title={draft.id ? `Edit ${draft.name || 'contact'}` : 'Add a New Contact'}>
        <Field label="Name" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} />
        <Field
          label="Email Address"
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
          label="Phone Number"
          value={draft.phone}
          toggle={{
            value: phoneOn(draft),
            disabled: !isPhoneNumber(draft.phone),
            onValueChange: (phoneEnabled) => setDraft((d) => ({ ...d, phoneEnabled })),
          }}
          onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
          keyboardType="phone-pad"
          hint="With country code, for example +41771234567."
        />
        <ThemedText type="small" themeColor="textSecondary">
          Barry only uses the email address and the phone number that are switched on.
        </ThemedText>
        <Row>
          <Button
            title={draft.id ? 'Save' : 'Add Contact'}
            onPress={save}
            busy={saving}
            disabled={draft.name.trim() === '' || !(emailOn(draft) || phoneOn(draft))}
          />
          {draft.id && <Button title="Cancel" kind="secondary" onPress={() => setDraft(blank)} />}
        </Row>
      </Section>
    </Screen>
  );
}
