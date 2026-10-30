import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Group } from '@/components/grouped-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { barry, type EmergencyContact, type SentMessage } from '@/lib/barry';
import { formatPhoneNumber } from '@/lib/phone';
import { type Texts, useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

const OUTCOME_SYMBOLS: Record<SentMessage['outcome'], { name: SymbolViewProps['name']; color: ThemeColor }> = {
  sent: { name: 'paperplane', color: 'textSecondary' },
  delivered: { name: 'checkmark.circle', color: 'success' },
  failed: { name: 'exclamationmark.triangle', color: 'warning' },
};

/**
 * The messages that went out to the Adventure's contacts or failed, newest first. It only shows them: a failed one
 * opens the card of the contact it was for, so the Adventurer can tell them themselves.
 */
export function SentMessages({ messages, contacts, now }: { messages: SentMessage[]; contacts: EmergencyContact[]; now: Date }) {
  const t = useTexts();
  if (messages.length === 0) return null;
  const time = (at: Date) => (at.toDateString() === now.toDateString() ? formatClock(at) : t.when(at));
  return (
    <Group title={t.adventure.messagesTitle}>
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} time={time(m.at)} onReach={() => void reach(t, m, contacts)} />
      ))}
    </Group>
  );
}

function MessageRow({ message, time, onReach }: { message: SentMessage; time: string; onReach: () => void }) {
  const theme = useTheme();
  const t = useTexts();
  const failed = message.outcome === 'failed';
  const outcome = OUTCOME_SYMBOLS[message.outcome];
  return (
    <Pressable
      disabled={!failed}
      onPress={onReach}
      accessibilityRole={failed ? 'button' : undefined}
      accessibilityLabel={t.adventure.messageLabel(message, time)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.top}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {t.adventure.messageName(message)}
        </ThemedText>
        <View style={styles.outcome}>
          <SymbolView name={outcome.name} size={14} weight="medium" tintColor={theme[outcome.color]} />
          <ThemedText mono themeColor={failed ? 'warning' : 'textSecondary'} style={styles.line}>
            {t.adventure.outcome(message, time)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.reach}>
        <SymbolView
          name={message.channel === 'email' ? 'envelope' : 'message'}
          size={13}
          weight="medium"
          tintColor={theme.textSecondary}
        />
        <ThemedText numberOfLines={1} themeColor="textSecondary" style={[styles.line, styles.address]}>
          {`${message.contacts.map((c) => c.name).join(', ')} · ${message.channel === 'sms' ? formatPhoneNumber(message.address) : message.address}`}
        </ThemedText>
      </View>
      {failed && (
        <ThemedText themeColor="warning" style={styles.line}>
          {t.adventure.failureReason(message.reason)}
        </ThemedText>
      )}
    </Pressable>
  );
}

const ask = (title: string, buttons: { text: string; value: string }[], cancel: string): Promise<string | null> =>
  new Promise((resolve) =>
    Alert.alert(title, undefined, [
      ...buttons.map((b) => ({ text: b.text, onPress: () => resolve(b.value) })),
      { text: cancel, style: 'cancel', onPress: () => resolve(null) },
    ]),
  );

// The phone's own card of the contact, or else the addresses Barry knows, through the phone's own apps.
const reach = async (t: Texts, message: SentMessage, contacts: EmergencyContact[]) => {
  const id =
    message.contacts.length === 1
      ? message.contacts[0]?.id
      : await ask(
          t.adventure.whichContact,
          message.contacts.map((c) => ({ text: c.name, value: c.id })),
          t.common.cancel,
        );
  const contact = message.contacts.find((c) => c.id === id);
  if (!contact) return;

  const shown = await barry.showPhoneContact(contact.id, {
    beforeAsking: () =>
      new Promise((resolve) =>
        Alert.alert(t.adventure.contactsAccessTitle, t.adventure.contactsAccessMessage, [
          { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: t.adventure.continue, onPress: () => resolve(true) },
        ]),
      ),
    closeTitle: t.adventure.close,
  });
  if (shown) return;

  const saved = contacts.find((c) => c.id === contact.id);
  const phone = saved?.phone ?? (message.channel === 'sms' ? message.address : null);
  const email = saved?.email ?? (message.channel === 'email' ? message.address : null);
  const url = await ask(
    t.adventure.reachTitle(contact.name),
    [
      ...(phone ? [{ text: t.adventure.call, value: `tel:${phone}` }, { text: t.adventure.text, value: `sms:${phone}` }] : []),
      ...(email ? [{ text: t.adventure.email, value: `mailto:${email}` }] : []),
    ],
    t.common.cancel,
  );
  if (url) await Linking.openURL(url).catch(() => undefined);
};

const styles = StyleSheet.create({
  row: { gap: 2, paddingHorizontal: Spacing.three, paddingVertical: 11 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: 400, flexShrink: 1 },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reach: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { flexShrink: 1 },
  line: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
});
