import { router, Stack } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { DoneSeal } from '@/components/done-seal';
import { Screen, Section, Unavailable } from '@/components/form';
import { Note } from '@/components/grouped-list';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { barry, type EndedAdventure } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { useTexts } from '@/lib/texts';

/** With onDone it is the screen right after the Check-in; without, an entry of the history. */
export function EndedAdventureScreen({ adventure, onDone }: { adventure: EndedAdventure; onDone?: () => void }) {
  const readings = useLoad(() => barry.readings(adventure.id));
  const t = useTexts();
  const theme = useTheme();

  // A failed delete is an alert here as in the lists, so the same action fails the same way everywhere.
  const remove = async () => {
    const outcome = await askToDeleteAdventure(adventure.id, 'ended');
    if (outcome.kind === 'deleted') router.back();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: adventure.plan.destination }} />
      {!onDone && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button icon="trash" accessibilityLabel={t.common.deleteLabel(adventure.plan.destination)} onPress={() => void remove()} />
        </Stack.Toolbar>
      )}
      <Note tone="success" icon="checkmark">
        {t.ended.checkedIn(t.when(adventure.checkedInAt)) + (onDone ? t.ended.welcome : '')}
      </Note>

      {readings.status === 'error' && (
        <View style={[styles.mapFailed, { backgroundColor: theme.backgroundElement }]}>
          <Unavailable
            compact
            symbol="map"
            title={t.ended.mapFailedTitle}
            message={readings.error.message}
            action={{ title: t.common.tryAgain, onPress: () => void readings.reload() }}
          />
        </View>
      )}
      {readings.status === 'ready' &&
        (readings.data.length > 0 ? (
          <TrailMapView trail={readings.data} last={readings.data.at(-1) ?? null} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t.ended.noPositions}
          </ThemedText>
        ))}
      {onDone && <DoneSeal title={t.common.done} onPress={onDone} />}

      <Section title={t.adventure.planSection}>
        <ThemedText type="small">{t.adventure.destination(adventure.plan.destination)}</ThemedText>
        {adventure.plan.route && <ThemedText type="small">{t.adventure.route(adventure.plan.route)}</ThemedText>}
        {adventure.alertsSent > 0 && <ThemedText type="small">{t.ended.alertsSent(adventure.alertsSent)}</ThemedText>}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The map's place, so a failure shows where the map would be.
  mapFailed: { borderRadius: 26, paddingBottom: 24, overflow: 'hidden' },
});
