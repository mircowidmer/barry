import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { barry, type EmergencyContact, type EmergencyContactId } from '@/lib/barry';

type Form = { id?: EmergencyContactId; name: string; phone: string; email: string };

const blank: Form = { name: '', phone: '', email: '' };

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

export default function ContactsScreen() {
  const loaded = useLoad(async () => {
    const [contacts, channels] = await Promise.all([barry.listContacts(), barry.enabledChannels()]);
    return { contacts, smsEnabled: channels.has('sms') };
  });
  const [draft, setDraft] = useState<Form>(blank);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const edit = (contact: EmergencyContact) => {
    setDraft({ id: contact.id, name: contact.name, phone: contact.phone ?? '', email: contact.email ?? '' });
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await barry.saveContact({
        id: draft.id,
        name: draft.name.trim(),
        phone: orNull(draft.phone.replace(/\s/g, '')),
        email: orNull(draft.email),
      });
      setMessage({ tone: 'success', text: `${draft.name.trim()} saved.` });
      setDraft(blank);
      loaded.reload();
    } catch {
      setMessage({
        tone: 'danger',
        text: 'Could not save. A contact needs a phone number with country code, an email address, or both.',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (contact: EmergencyContact) => {
    const result = await barry.removeContact(contact.id);
    setMessage(
      result.kind === 'removed'
        ? { tone: 'success', text: `${contact.name} removed.` }
        : { tone: 'danger', text: `${contact.name} is a contact of your current Adventure, so they stay until you check in.` },
    );
    if (draft.id === contact.id) setDraft(blank);
    loaded.reload();
  };

  return (
    <Screen title="Emergency Contacts">
      <ThemedText themeColor="textSecondary">
        The people Barry tells when you start an Adventure, and again if you don’t check in. They don’t need the app.
      </ThemedText>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {loaded.status === 'error' && <Notice tone="danger">Could not load your contacts.</Notice>}
      {loaded.data?.contacts.map((contact) => (
        <Section key={contact.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${contact.name}`} onPress={() => edit(contact)}>
            <ThemedText type="smallBold">{contact.name}</ThemedText>
            {contact.email && <ThemedText type="small">{contact.email}</ThemedText>}
            {contact.phone && (
              <ThemedText type="small">
                {contact.phone}
                {!loaded.data.smsEnabled && '  ·  Text messages not set up yet'}
              </ThemedText>
            )}
          </Pressable>
          <Row>
            <Button title="Edit" kind="secondary" onPress={() => edit(contact)} />
            <Button title="Remove" kind="danger" onPress={() => remove(contact)} />
          </Row>
        </Section>
      ))}
      <Section title={draft.id ? `Edit ${draft.name || 'contact'}` : 'Add a New Contact'}>
        <Field label="Name" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} />
        <Field
          label="Email"
          value={draft.email}
          onChangeText={(email) => setDraft((d) => ({ ...d, email }))}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Phone number"
          value={draft.phone}
          onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
          keyboardType="phone-pad"
          hint="With country code, for example +41771234567."
        />
        <Row>
          <Button
            title={draft.id ? 'Save Changes' : 'Add Contact'}
            onPress={save}
            busy={saving}
            disabled={draft.name.trim() === '' || (draft.email.trim() === '' && draft.phone.trim() === '')}
          />
          {draft.id && <Button title="Cancel" kind="secondary" onPress={() => setDraft(blank)} />}
        </Row>
      </Section>
    </Screen>
  );
}
