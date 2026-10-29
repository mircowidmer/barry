import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Section } from '@/components/form';
import { GroupHeader, Note } from '@/components/grouped-list';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import {
  type Adventure,
  type AvalancheBulletin,
  barry,
  type DaylightView,
  daylightView,
  type ForecastView,
  forecastView,
  HOUR_MS,
  type Point,
} from '@/lib/barry';
import { useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

// The European avalanche danger scale's own colours, which the bulletin uses too.
const DANGER_COLOURS = ['#CCFF66', '#FFFF00', '#FF9900', '#FF0000', '#9B0000'];
const SUBDIVISION = { minus: '−', neutral: '=', plus: '+' } as const;

const symbol = (code: number, dark: boolean): SymbolViewProps['name'] => {
  if (code === 0) return dark ? 'moon.stars' : 'sun.max';
  if (code <= 2) return dark ? 'cloud.moon' : 'cloud.sun';
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

/** The weather, the avalanche bulletin and the daylight at the destination on the map. Advice only, so it warns about nothing. */
export function ConditionsSection({ adventure }: { adventure: Adventure }) {
  const t = useTexts();
  const point = adventure.plan.destinationPoint;
  if (!point) {
    return (
      <Section title={t.conditions.title}>
        <Note icon="mappin.slash">{t.conditions.noPoint}</Note>
      </Section>
    );
  }
  // A moved pin is another place, so it loads afresh; a moved Deadline only changes what is shown.
  return <ConditionsAt key={`${point.latitude},${point.longitude}`} point={point} deadline={adventure.deadline} />;
}

function ConditionsAt({ point, deadline }: { point: Point; deadline: Date | null }) {
  const t = useTexts();
  const now = useNow();
  const loaded = useLoad(() => barry.conditions(point));
  const result = loaded.data;
  const conditions = result && result.kind !== 'unavailable' ? result.conditions : null;
  const forecast = conditions?.forecast ?? null;
  const hour = Math.floor(now.getTime() / HOUR_MS);
  // The hours change only with the hour, not with every tick of the clock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => forecast && forecastView(forecast, point, deadline, now), [forecast, point, deadline, hour]);
  return (
    <View style={styles.titled}>
      <GroupHeader title={t.conditions.title} />
      <Section>
        <Daylight daylight={daylightView(point, deadline, now)} now={now} />
      </Section>
      {result?.kind === 'unavailable' && <Note icon="wifi.slash">{t.conditions.needSignal}</Note>}
      {result?.kind === 'stale' && <Note icon="wifi.slash">{t.conditions.asOf(t.when(result.conditions.fetchedAt))}</Note>}
      {shown && shown.hours.length > 0 && <Forecast forecast={shown} />}
      {conditions?.bulletin && <Bulletin bulletin={conditions.bulletin} />}
      <ThemedText type="small" themeColor="textSecondary">
        {t.conditions.credits}
      </ThemedText>
    </View>
  );
}

function Daylight({ daylight, now }: { daylight: DaylightView; now: Date }) {
  const t = useTexts();
  return (
    <>
      {daylight.otherDay && <ThemedText type="smallBold">{t.conditions.on(t.day(daylight.otherDay, now))}</ThemedText>}
      <View style={styles.daylight}>
        <Clock icon="sunset" label={t.conditions.sunset} at={daylight.sunset} />
        <Clock icon="moon.stars" label={t.conditions.dark} at={daylight.dark} />
      </View>
      {!daylight.sunset && <ThemedText type="small">{t.conditions.noSunset}</ThemedText>}
      {daylight.sunset && !daylight.dark && <ThemedText type="small">{t.conditions.noDark}</ThemedText>}
      {daylight.left !== null && <ThemedText type="small">{t.conditions.left(t.duration(daylight.left))}</ThemedText>}
    </>
  );
}

function Forecast({ forecast }: { forecast: ForecastView }) {
  const t = useTexts();
  return (
    <Section>
      <ThemedText type="smallBold">{t.conditions.forecast}</ThemedText>
      <View style={styles.table}>
        {/* VoiceOver reads each hour as a sentence with its units, so the label column is decoration to it. */}
        <View style={[styles.hour, styles.labels]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ThemedText type="small"> </ThemedText>
          <View style={styles.symbolSpace} />
          <RowLabel icon="thermometer.medium" />
          {!forecast.dry && <RowLabel icon="drop" unit={t.conditions.units.precipitation} />}
          <RowLabel icon="wind" unit={t.conditions.units.gusts} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.hours}>
          {forecast.hours.map((h) => (
            <Hour key={h.at.getTime()} hour={h} dry={forecast.dry} />
          ))}
        </ScrollView>
      </View>
      {forecast.dry && (
        <ThemedText type="small" themeColor="textSecondary">
          {t.conditions.dry}
        </ThemedText>
      )}
      {forecast.freezingLevelM && (
        <ThemedText type="small" themeColor="textSecondary">
          {t.conditions.freezingLevel(metres(forecast.freezingLevelM.low), metres(forecast.freezingLevelM.high))}
        </ThemedText>
      )}
      {forecast.reachesFrom && (
        <ThemedText type="small" themeColor="textSecondary">
          {t.conditions.forecastFrom(t.when(forecast.reachesFrom))}
        </ThemedText>
      )}
    </Section>
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

function RowLabel({ icon, unit }: { icon: SymbolViewProps['name']; unit?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.rowLabel}>
      <SymbolView name={icon} size={14} tintColor={theme.textSecondary} fallback={null} />
      {unit && (
        <ThemedText type="small" themeColor="textSecondary">
          {unit}
        </ThemedText>
      )}
    </View>
  );
}

function Hour({ hour, dry }: { hour: ForecastView['hours'][number]; dry: boolean }) {
  const theme = useTheme();
  const t = useTexts();
  const time = formatClock(hour.at);
  const temperature = `${Math.round(hour.temperatureC)}°`;
  const precipitation = hour.precipitationMm === null ? null : `${hour.precipitationMm.toFixed(1)} mm`;
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
        name={symbol(hour.weatherCode, hour.dark)}
        size={22}
        type="multicolor"
        tintColor={hour.thunderstorm ? theme.warning : theme.text}
        fallback={null}
      />
      <ThemedText type="smallBold">{temperature}</ThemedText>
      {!dry && (
        <ThemedText type="small" themeColor={hour.precipitationMm ? 'accent' : 'textSecondary'}>
          {hour.precipitationMm === null ? '–' : hour.precipitationMm > 0 ? hour.precipitationMm.toFixed(1) : '0'}
        </ThemedText>
      )}
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
      <ThemedText
        type="small"
        themeColor="accent"
        accessibilityRole="link"
        style={styles.link}
        onPress={() => void Linking.openURL(t.conditions.bulletinUrl).catch(() => undefined)}>
        {t.conditions.fullBulletin}
      </ThemedText>
    </Section>
  );
}

const styles = StyleSheet.create({
  titled: { gap: 6 },
  daylight: { flexDirection: 'row', gap: 24 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockTime: { fontSize: 22, lineHeight: 28, fontWeight: 600 },
  table: { flexDirection: 'row', gap: 4 },
  scroll: { flex: 1 },
  hours: { gap: 4 },
  hour: { alignItems: 'center', gap: 4, minWidth: 44, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10 },
  labels: { alignItems: 'flex-start', minWidth: 0 },
  // The spacer and the row labels take the heights of the symbol and of the small text, so the rows line up with the hours.
  symbolSpace: { height: 22 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelSquare: { minWidth: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  levelNumber: { fontSize: 18, lineHeight: 22, fontWeight: 700, color: '#000000' },
  // Padding brings the small text up to the 44-point hit target iOS asks for.
  link: { paddingVertical: 12 },
});
