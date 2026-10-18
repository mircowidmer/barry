import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Notice, Screen, Section } from '@/components/form';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { barry, type EmergencyContact } from '@/lib/barry';
import { formatPhoneNumber } from '@/lib/phone';
import { askToRemoveContact } from '@/lib/remove-contact';
import { useTexts } from '@/lib/texts';

export default function ContactsScreen() {
  const loaded = useLoad(async () => {
    const [contacts, channels] = await Promise.all([barry.listContacts(), barry.enabledChannels()]);
    return { contacts, smsEnabled: channels.has('sms') };
  });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const t = useTexts();

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
    loaded.reload();
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t.contacts.addLabel} onPress={() => router.push('/contacts/edit')} />
      </Stack.Toolbar>
      <Screen onRefresh={loaded.reload}>
        <ThemedText themeColor="textSecondary">{t.contacts.intro}</ThemedText>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {loaded.status === 'error' && <Notice tone="danger">{t.contacts.couldNotLoad}</Notice>}
        {loaded.data?.contacts.map((contact) => (
          <SwipeToDelete key={contact.id} label={t.common.deleteLabel(contact.name)} onDelete={() => remove(contact)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.contacts.editLabel(contact.name)}
              onPress={() => router.push({ pathname: '/contacts/edit', params: { id: contact.id } })}>
              <Section>
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
              </Section>
            </Pressable>
          </SwipeToDelete>
        ))}
      </Screen>
    </>
  );
}
