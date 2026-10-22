import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flash } from '@/components/flash';
import { LoadState, Notice, Screen } from '@/components/form';
import { ActionRow, Group } from '@/components/grouped-list';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { barry, type EmergencyContact } from '@/lib/barry';
import { askToRemoveContact } from '@/lib/remove-contact';
import { type Texts, useTexts } from '@/lib/texts';

const AVATAR = 44;

// The heights of iOS's collapsed navigation bar and of the tab bar, above the safe area insets.
const NAVIGATION_BAR_HEIGHT = 44;
const TAB_BAR_HEIGHT = 49;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
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
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState<EmergencyContact['id'] | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const t = useTexts();

  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  // The list is sorted by name, so the new row can land off screen. iOS's zoomToRect scrolls it into view
  // within the large title and the tab bar, which a plain scrollTo does not know about. It also centres a row
  // that is already in view, and on a short list that pulls the page down past its top, so it runs only for a
  // row that is not fully in view. The row sits inside its group, so it is measured against the scroll view's
  // content rather than its parent.
  const reveal = (event: LayoutChangeEvent) => {
    const row = event.currentTarget;
    const content = scroll.current?.getInnerViewRef();
    if (typeof row === 'number' || !content) return;
    row.measureInWindow((_x, top, _width, height) => {
      const inView = top >= insets.top + NAVIGATION_BAR_HEIGHT && top + height <= window.height - insets.bottom - TAB_BAR_HEIGHT;
      if (inView) return;
      row.measureLayout(content, (x, y, width, rowHeight) =>
        scroll.current?.scrollResponderZoomTo({ x, y, width, height: rowHeight, animated: true }),
      );
    });
  };

  const add = async () => {
    setPicking(true);
    setMessage(null);
    try {
      const outcome = await barry.addContactFromPhone();
      if (outcome.kind === 'added') {
        setAdded(outcome.contact.id);
        void loaded.reload();
      }
      else if (outcome.kind === 'duplicate') setMessage({ tone: 'danger', text: t.contacts.alreadyAdded(outcome.name) });
      else if (outcome.kind === 'unreachable') setMessage({ tone: 'danger', text: t.contacts.nothingToReach(outcome.name) });
    } catch {
      setMessage({ tone: 'danger', text: t.contacts.couldNotAdd });
    } finally {
      setPicking(false);
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
    void loaded.reload();
  };

  const data = loaded.data;
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t.contacts.addLabel} disabled={picking} onPress={() => void add()} />
      </Stack.Toolbar>
      <Screen ref={scroll} onRefresh={loaded.reload}>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <LoadState loaded={loaded} failure={() => t.contacts.couldNotLoad} />
        {data && data.contacts.length === 0 && (
          <>
            <ThemedText themeColor="textSecondary">{t.contacts.intro}</ThemedText>
            <Group footer={t.contacts.empty}>
              <ActionRow title={t.contacts.pick} onPress={() => void add()} busy={picking} />
            </Group>
          </>
        )}
        {data && data.contacts.length > 0 && (
          <Group footer={t.contacts.intro} inset={Spacing.three + AVATAR + 12}>
            {data.contacts.map((contact) => (
              <Flash key={contact.id} active={contact.id === added} onLayout={contact.id === added ? reveal : undefined}>
                <SwipeToDelete flush label={t.common.deleteLabel(contact.name)} onDelete={() => void remove(contact)}>
                  <ContactRow contact={contact} reach={reach(contact, data.smsEnabled, t)} />
                </SwipeToDelete>
              </Flash>
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
      accessibilityHint={t.common.openLabel(contact.name)}
      onPress={() => router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })}
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
