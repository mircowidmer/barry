import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoadState, Notice, Screen } from '@/components/form';
import { Group } from '@/components/grouped-list';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { barry, type EmergencyContact } from '@/lib/barry';
import { askToRemoveContact } from '@/lib/remove-contact';
import { type Texts, useTexts } from '@/lib/texts';

const AVATAR = 44;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/** How Barry reaches the contact, and whether that line is a warning: a number Barry cannot text yet. */
const reach = (contact: EmergencyContact, smsEnabled: boolean, t: Texts) => {
  const email = contact.emailEnabled && contact.email !== null;
  const phone = contact.phoneEnabled && contact.phone !== null;
  if (phone && !smsEnabled) {
    return { text: email ? `${t.contacts.emailOnly} · ${t.contacts.smsNotSetUp}` : t.contacts.smsNotSetUp, warning: true };
  }
  return { text: email && phone ? t.contacts.emailAndText : email ? t.contacts.emailOnly : t.contacts.textOnly, warning: false };
};

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

  const data = loaded.data;
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t.contacts.addLabel} onPress={() => router.push('/contacts/edit')} />
      </Stack.Toolbar>
      <Screen onRefresh={loaded.reload}>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <LoadState loaded={loaded} failure={() => t.contacts.couldNotLoad} />
        {data && data.contacts.length === 0 && <ThemedText themeColor="textSecondary">{t.contacts.intro}</ThemedText>}
        {data && data.contacts.length > 0 && (
          <Group footer={t.contacts.intro} inset={Spacing.three + AVATAR + 12}>
            {data.contacts.map((contact) => (
              <SwipeToDelete key={contact.id} flush label={t.common.deleteLabel(contact.name)} onDelete={() => remove(contact)}>
                <ContactRow contact={contact} reach={reach(contact, data.smsEnabled, t)} />
              </SwipeToDelete>
            ))}
          </Group>
        )}
      </Screen>
    </>
  );
}

/** A contact as in the Phone app: the initials, the name, how Barry reaches them, and an info button. */
function ContactRow({ contact, reach }: { contact: EmergencyContact; reach: { text: string; warning: boolean } }) {
  const theme = useTheme();
  const t = useTexts();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${reach.text}`}
      accessibilityHint={t.contacts.editLabel(contact.name)}
      onPress={() => router.push({ pathname: '/contacts/edit', params: { id: contact.id } })}
      // The row must be opaque, so the swipe action shows only beside it, never through it.
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        <ThemedText style={[styles.initials, { color: theme.onAccent }]}>{initials(contact.name)}</ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={1} style={styles.name}>
          {contact.name}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} themeColor={reach.warning ? 'warning' : 'textSecondary'} style={styles.reach}>
          {reach.text}
        </ThemedText>
      </View>
      <SymbolView
        name="info.circle"
        size={22}
        tintColor={theme.accent}
        fallback={<ThemedText themeColor="accent" style={styles.info}>ⓘ</ThemedText>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingHorizontal: Spacing.three },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  text: { flex: 1, paddingVertical: 10 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  reach: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
  info: { fontSize: 20 },
});
