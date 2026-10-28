import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FirstLoad, Screen } from '@/components/form';
import { ActionRow, Group, InfoNote, Note } from '@/components/grouped-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useStringParam } from '@/hooks/use-string-param';
import { useTheme } from '@/hooks/use-theme';
import { type AdventureId, barry, type EmergencyContact, reachableAddresses } from '@/lib/barry';
import { initials } from '@/lib/initials';
import { formatPhoneNumber } from '@/lib/phone';
import { useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

const AVATAR = 40;

/**
 * The sheet behind the contacts button of a Live Adventure: who Barry tells, on which addresses, which messages
 * did not arrive, and what Barry sends next.
 */
export default function WatchingSheet() {
  const id = useStringParam<AdventureId>('id');
  const loaded = useLoad(async () => {
    const { adventure } = await barry.getInProgressAdventure();
    if (!adventure || adventure.id !== id) return null;
    const failures = await barry.deliveryFailures(adventure.id).catch(() => []);
    return { adventure, failures };
  });
  const t = useTexts();
  const now = useNow();

  const close = (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
    </Stack.Toolbar>
  );
  if (!loaded.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t.adventure.watchingTitle }} />
        {close}
        <FirstLoad failure={loaded.data === null ? t.plan.couldNotLoad : loaded.error && t.common.couldNotReach} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }

  const { adventure, failures } = loaded.data;
  const alertAt = adventure.alertAt;
  const alertTime = alertAt.toDateString() === now.toDateString() ? formatClock(alertAt) : t.when(alertAt);
  return (
    <Screen onRefresh={loaded.reload}>
      <Stack.Screen options={{ title: t.adventure.watchingTitle }} />
      {close}
      <Group inset={Spacing.three + AVATAR + 12}>
        {adventure.contacts.map((c) => (
          <ContactLine key={c.id} contact={c} />
        ))}
      </Group>

      {failures.length > 0 && (
        <Group title={t.adventure.failuresTitle}>
          {failures.map((f) => (
            <View key={f.id} style={styles.failure}>
              <ThemedText themeColor="warning" style={styles.line}>
                {t.adventure.failure(f)}
              </ThemedText>
            </View>
          ))}
        </Group>
      )}

      {adventure.stage === 'alerted' ? (
        <Note tone="danger">{t.adventure.alerted(adventure.alertsSent)}</Note>
      ) : (
        <Group title={t.adventure.nextSection}>
          <View style={styles.nextAlert} accessible accessibilityLabel={`${t.adventure.nextAlert}, ${t.when(alertAt)}`}>
            <ThemedText style={styles.title}>{t.adventure.nextAlert}</ThemedText>
            <ThemedText mono themeColor="textSecondary" style={styles.time}>
              {alertTime}
            </ThemedText>
          </View>
          <View style={styles.next}>
            <ThemedText style={styles.title}>{t.adventure.nextAllClear}</ThemedText>
          </View>
        </Group>
      )}
      <InfoNote>{t.adventure.failureNote}</InfoNote>

      {adventure.stage !== 'alerted' && (
        <Group>
          <ActionRow
            title={t.adventure.editContacts}
            centered
            onPress={() => router.replace({ pathname: '/plan', params: { id: adventure.id } })}
          />
        </Group>
      )}
    </Screen>
  );
}

/** A contact of the Adventure: the initials, the name, and the addresses Barry writes to. */
function ContactLine({ contact }: { contact: EmergencyContact }) {
  const theme = useTheme();
  const { email, phone } = reachableAddresses(contact);
  const reach = [email, phone && formatPhoneNumber(phone)].filter(Boolean).join(' · ');
  return (
    <View style={styles.contact} accessible accessibilityLabel={`${contact.name}, ${reach}`}>
      <View style={[styles.avatar, { backgroundColor: theme.textSecondary }]}>
        <ThemedText style={[styles.initials, { color: theme.background }]}>{initials(contact.name)}</ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {contact.name}
        </ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.line}>
          {reach}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: Spacing.three },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, lineHeight: 21, fontWeight: 600 },
  text: { flex: 1, paddingVertical: 11 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: 400, flexShrink: 1 },
  line: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 50, paddingHorizontal: Spacing.three },
  nextAlert: { gap: 2, paddingHorizontal: Spacing.three, paddingVertical: 11 },
  time: { fontSize: 16, lineHeight: 22, fontWeight: 500 },
  failure: { paddingHorizontal: Spacing.three, paddingVertical: 11 },
});
