import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FirstLoad, LoadState, Screen } from '@/components/form';
import { ActionRow, Group, InfoNote } from '@/components/grouped-list';
import { openPrivacy, openTerms } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { type AdventurerProfile, barry } from '@/lib/barry';
import { askToDeleteAccount } from '@/lib/delete-account';
import { askToLogOut } from '@/lib/log-out';
import { formatPhoneNumber } from '@/lib/phone';
import { useTexts } from '@/lib/texts';

const AVATAR = 76;
const TILE = 30;
const TILE_GAP = 14;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const carSummary = (p: AdventurerProfile | null) =>
  [p?.carMake, p?.carColour, p?.carPlate].filter((part): part is string => Boolean(part)).join(' · ');

/**
 * The Profile as in the Account header of Settings: who the Adventurer is, with Edit, then one row each for the car
 * and the medical notes an Alert carries. Each opens its own screen, which saves the Profile.
 */
export default function ProfileScreen() {
  const loaded = useLoad(() => barry.getProfile());
  const t = useTexts();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    const outcome = await askToDeleteAccount(() => setDeleting(true));
    setDeleting(false);
    if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };

  const profile = loaded.data;
  // The stored Profile needs a name, so the car and the medical notes wait until there is one.
  const named = profile !== undefined && profile !== null;
  return (
    <Screen onRefresh={loaded.reload}>
      {profile === undefined ? (
        <FirstLoad failure={loaded.error && t.common.couldNotReach} onRetry={() => void loaded.reload()} />
      ) : (
        <>
          <LoadState loaded={loaded} failure={() => t.common.couldNotReach} />
          <Header profile={profile} />
          <Group
            title={t.profile.inAlert}
            footer={named ? t.profile.alertFooter : t.profile.nameFirst}
            footerInfo
            inset={Spacing.three + TILE + TILE_GAP}>
            <SummaryRow
              symbol="car.fill"
              fallback="C"
              tile="accent"
              title={t.profile.car}
              summary={carSummary(profile) || t.profile.notSet}
              disabled={!named}
              onPress={() => router.push('/profile/car')}
            />
            <SummaryRow
              symbol="cross.case.fill"
              fallback="+"
              tile="danger"
              title={t.profile.medical}
              summary={profile?.medicalNotes ?? t.profile.notSet}
              disabled={!named}
              onPress={() => router.push('/profile/medical')}
            />
          </Group>
        </>
      )}

      <Group title={t.profile.accountSection}>
        <ActionRow title={t.profile.account} tone="text" chevron onPress={() => router.push('/profile/account')} />
        <ActionRow title={t.legal.privacy} tone="text" chevron onPress={() => void openPrivacy()} />
        <ActionRow title={t.legal.terms} tone="text" chevron onPress={() => void openTerms()} />
      </Group>

      <Group>
        <ActionRow title={t.profile.logOut} centered onPress={() => void askToLogOut()} />
        <ActionRow title={t.profile.deleteAccount} tone="danger" centered onPress={() => void deleteAccount()} busy={deleting} />
      </Group>

      <InfoNote>{t.legal.notEmergency}</InfoNote>
    </Screen>
  );
}

/** Who the Adventurer is: the initials, the name and the phone number, with Edit for both. */
function Header({ profile }: { profile: AdventurerProfile | null }) {
  const theme = useTheme();
  const t = useTexts();
  const name = profile?.name ?? '';
  const phone = profile?.phone ? formatPhoneNumber(profile.phone) : t.profile.noPhone;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name === '' ? t.profile.addName : `${name}, ${phone}`}
      accessibilityHint={t.profile.editHint}
      onPress={() => router.push('/profile/about')}
      style={({ pressed }) => [styles.header, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        {name === '' ? (
          <SymbolView
            name="person.fill"
            size={34}
            tintColor={theme.onAccent}
            fallback={<ThemedText style={[styles.initials, { color: theme.onAccent }]}>?</ThemedText>}
          />
        ) : (
          <ThemedText style={[styles.initials, { color: theme.onAccent }]}>{initials(name)}</ThemedText>
        )}
      </View>
      <ThemedText mono={name !== ''} style={styles.name}>
        {name === '' ? t.profile.addName : name}
      </ThemedText>
      {name !== '' && (
        <ThemedText themeColor="textSecondary" mono={profile?.phone != null} style={styles.line}>
          {phone}
        </ThemedText>
      )}
      <ThemedText themeColor="accent" style={styles.line}>
        {t.profile.edit}
      </ThemedText>
    </Pressable>
  );
}

/** A row as in Settings: a tinted symbol, the title, what is stored, and a chevron to its own screen. */
function SummaryRow({
  symbol,
  fallback,
  tile,
  title,
  summary,
  disabled,
  onPress,
}: {
  symbol: SymbolViewProps['name'];
  fallback: string;
  tile: ThemeColor;
  title: string;
  summary: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${summary}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.45 : 1 },
      ]}>
      <View style={[styles.tile, { backgroundColor: theme[tile] }]}>
        <SymbolView
          name={symbol}
          size={17}
          tintColor={theme.background}
          fallback={<ThemedText style={{ color: theme.background }}>{fallback}</ThemedText>}
        />
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.line}>
          {summary}
        </ThemedText>
      </View>
      <SymbolView
        name="chevron.right"
        size={14}
        weight="semibold"
        tintColor={theme.textSecondary}
        fallback={<ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { borderRadius: 12, alignItems: 'center', gap: 4, paddingVertical: Spacing.four, paddingHorizontal: Spacing.three },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  initials: { fontSize: 30, lineHeight: 36, fontWeight: 600 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: 700, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: TILE_GAP, minHeight: 60, paddingHorizontal: Spacing.three },
  tile: { width: TILE, height: TILE, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, paddingVertical: 9 },
  title: { fontSize: 17, lineHeight: 22 },
  line: { fontSize: 15, lineHeight: 20 },
  chevron: { fontSize: 22 },
});
