import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { pressedStyle, Section } from '@/components/form';
import { GroupHeader, Note } from '@/components/grouped-list';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { type Adventure, type AvalancheBulletin, barry, type DaylightView, forecastWindow, type ForecastHour } from '@/lib/barry';
import { type Texts, useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

// The European avalanche danger scale's own colours, which the bulletin uses too.
const DANGER_COLOURS = ['#CCFF66', '#FFFF00', '#FF9900', '#FF0000', '#9B0000'];
const SUBDIVISION = { minus: '−', neutral: '=', plus: '+' } as const;

const symbol = (code: number): SymbolViewProps['name'] => {
  if (code === 0) return 'sun.max';
  if (code <= 2) return 'cloud.sun';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'cloud.fog';
  if (code <= 57) return 'cloud.drizzle';
  if (code <= 67) return 'cloud.rain';
  if (code <= 77) return 'cloud.snow';
  if (code <= 82) return 'cloud.heavyrain';
  if (code <= 86) return 'cloud.snow';
  return 'cloud.bolt.rain';
};

const metres = (m: number) => String(Math.round(m / 100) * 100);

/**
 * The weather, the avalanche bulletin and the daylight at the destination on the map. Advice only: the one warning is
 * the Dark one, which the Plan sheet already shows under the Deadline, so it can leave it out here.
 */
export function ConditionsSection({ adventure, darkWarning = true }: { adventure: Adventure; darkWarning?: boolean }) {
  const t = useTexts();
  const now = useNow();
  const loaded = useLoad(() => barry.conditions(adventure));
  const view = loaded.data;
  if (!view) return null;
  if (view.kind === 'no_point') {
    return (
      <Section title={t.conditions.title}>
        <Note icon="mappin.slash">{t.conditions.noPoint}</Note>
      </Section>
    );
  }

  const window = view.kind === 'unavailable' ? null : forecastWindow(view.conditions.forecast, now, adventure.deadline);
  const freezing = window?.hours.map((h) => h.freezingLevelM).filter((m): m is number => m !== null) ?? [];
  return (
    <View style={styles.titled}>
      <GroupHeader title={t.conditions.title} />
      <Section>
        <Daylight daylight={view.daylight} deadline={adventure.deadline} now={now} />
        {darkWarning && view.daylight.afterDark && (
          <Note tone="warning" icon="moon.stars">
            {t.conditions.afterDark(t.when(view.daylight.afterDark))}
          </Note>
        )}
      </Section>
      {view.kind === 'unavailable' ? (
        <Note icon="wifi.slash">{t.conditions.needSignal}</Note>
      ) : (
        <>
          {view.kind === 'stale' && <Note icon="wifi.slash">{t.conditions.asOf(t.when(view.conditions.fetchedAt))}</Note>}
          {window && window.hours.length > 0 && (
            <Section>
              <ThemedText type="smallBold">{t.conditions.forecast}</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
                {window.hours.map((h) => (
                  <Hour key={h.at.getTime()} hour={h} t={t} />
                ))}
              </ScrollView>
              {freezing.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t.conditions.freezingLevel(metres(Math.min(...freezing)), metres(Math.max(...freezing)))}
                </ThemedText>
              )}
              {window.reachesFrom && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t.conditions.forecastFrom(t.when(window.reachesFrom))}
                </ThemedText>
              )}
            </Section>
          )}
          {view.conditions.bulletin && <Bulletin bulletin={view.conditions.bulletin} />}
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {t.conditions.credits}
      </ThemedText>
    </View>
  );
}

function Daylight({ daylight, deadline, now }: { daylight: DaylightView; deadline: Date | null; now: Date }) {
  const t = useTexts();
  const otherDay = deadline && deadline > now && deadline.toDateString() !== now.toDateString();
  return (
    <>
      {otherDay && <ThemedText type="smallBold">{t.conditions.on(t.day(deadline, now))}</ThemedText>}
      <View style={styles.daylight}>
        <Clock icon="sunset" label={t.conditions.sunset} at={daylight.sunset} />
        <Clock icon="moon.stars" label={t.conditions.dark} at={daylight.dark} />
      </View>
      {!daylight.sunset && <ThemedText type="small">{t.conditions.noSunset}</ThemedText>}
      {daylight.sunset && !daylight.dark && <ThemedText type="small">{t.conditions.noDark}</ThemedText>}
      {daylight.left !== null && daylight.dark && daylight.dark > now && (
        <ThemedText type="small">{t.conditions.left(t.duration(daylight.dark.getTime() - now.getTime()))}</ThemedText>
      )}
    </>
  );
}

function Clock({ icon, label, at }: { icon: SymbolViewProps['name']; label: string; at: Date | null }) {
  const theme = useTheme();
  if (!at) return null;
  return (
    <View style={styles.clock} accessible accessibilityLabel={`${label} ${formatClock(at)}`}>
      <SymbolView name={icon} size={20} tintColor={theme.textSecondary} fallback={null} />
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText mono style={styles.clockTime}>
          {formatClock(at)}
        </ThemedText>
      </View>
    </View>
  );
}

function Hour({ hour, t }: { hour: ForecastHour; t: Texts }) {
  const theme = useTheme();
  const time = formatClock(hour.at);
  const temperature = `${Math.round(hour.temperatureC)}°`;
  const precipitation = `${hour.precipitationMm.toFixed(1)} mm`;
  const gusts = `${Math.round(hour.gustsKmh)} km/h`;
  return (
    <View
      style={[styles.hour, hour.thunderstorm && { backgroundColor: `${theme.warning}1F` }]}
      accessible
      accessibilityLabel={t.conditions.hour(time, temperature, precipitation, gusts, hour.thunderstorm)}>
      <ThemedText type="small" mono themeColor="textSecondary">
        {time.slice(0, 2)}
      </ThemedText>
      <SymbolView
        name={symbol(hour.weatherCode)}
        size={22}
        type="multicolor"
        tintColor={hour.thunderstorm ? theme.warning : theme.text}
        fallback={null}
      />
      <ThemedText type="smallBold">{temperature}</ThemedText>
      <ThemedText type="small" themeColor={hour.precipitationMm > 0 ? 'accent' : 'textSecondary'}>
        {hour.precipitationMm > 0 ? hour.precipitationMm.toFixed(1) : '–'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {Math.round(hour.gustsKmh)}
      </ThemedText>
    </View>
  );
}

function Bulletin({ bulletin }: { bulletin: AvalancheBulletin }) {
  const t = useTexts();
  const name = t.conditions.levels[bulletin.level - 1] ?? '';
  const level = `${bulletin.level}${bulletin.subdivision ? SUBDIVISION[bulletin.subdivision] : ''}`;
  return (
    <Section>
      <ThemedText type="smallBold">{t.conditions.avalanche}</ThemedText>
      <View style={styles.level} accessible accessibilityLabel={t.conditions.level(bulletin.level, name)}>
        <View style={[styles.levelSquare, { backgroundColor: DANGER_COLOURS[bulletin.level - 1] }]}>
          <ThemedText mono style={[styles.levelNumber, bulletin.level >= 4 && { color: '#FFFFFF' }]}>
            {level}
          </ThemedText>
        </View>
        <ThemedText>{name}</ThemedText>
      </View>
      {bulletin.problems.length > 0 && (
        <ThemedText type="small">{bulletin.problems.map((p) => t.conditions.problems[p] ?? p).join(' · ')}</ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {t.conditions.validUntil(t.when(bulletin.validUntil))}
      </ThemedText>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(t.conditions.bulletinUrl)} style={pressedStyle}>
        <ThemedText type="small" themeColor="accent">
          {t.conditions.fullBulletin}
        </ThemedText>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  titled: { gap: 6 },
  daylight: { flexDirection: 'row', gap: 24 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockTime: { fontSize: 22, lineHeight: 28, fontWeight: 600 },
  hours: { gap: 4 },
  hour: { alignItems: 'center', gap: 4, minWidth: 44, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelSquare: { minWidth: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  levelNumber: { fontSize: 18, lineHeight: 22, fontWeight: 700, color: '#000000' },
});
