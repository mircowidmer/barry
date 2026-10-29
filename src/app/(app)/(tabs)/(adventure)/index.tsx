import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { EndedAdventureScreen } from '@/components/ended-adventure-screen';
import { FirstLoad, LoadState, pressedStyle, Screen, Section } from '@/components/form';
import { GroupHeader, Note } from '@/components/grouped-list';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useTrailStatus } from '@/hooks/use-trail-status';
import { type Adventure, type AdventureId, barry, type DeliveryFailure, type InProgressAdventure, type Position, type TrailStatus } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { useOfferCheckIn } from '@/lib/live-check-in';
import { refusalText, useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

export default function AdventureScreen() {
  const loaded = useLoad(async () => {
    const { adventure: inProgress, offlineSince } = await barry.getInProgressAdventure();
    const adventures = inProgress || offlineSince ? [] : await barry.listAdventures();
    return { inProgress, offlineSince, adventures, pending: barry.pendingCheckIns() };
  });
  const t = useTexts();

  if (loaded.data === undefined) {
    return (
      <Screen>
        <FirstLoad failure={loaded.error && t.common.couldNotReach} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }

  const { inProgress, offlineSince, adventures, pending } = loaded.data;
  const reloadFailure = <LoadState loaded={loaded} failure={() => t.common.couldNotReach} />;
  const queued = inProgress && pending.find((c) => c.adventureId === inProgress.id);

  return inProgress ? (
    <LiveAdventure
      key={inProgress.id}
      adventure={inProgress}
      offlineSince={offlineSince}
      queuedAt={queued?.checkedInAt ?? null}
      reloadFailure={reloadFailure}
      onChanged={loaded.reload}
    />
  ) : (
    <Overview adventures={adventures} offlineSince={offlineSince} reloadFailure={reloadFailure} onReload={loaded.reload} />
  );
}

function Overview({
  adventures,
  offlineSince,
  reloadFailure,
  onReload,
}: {
  adventures: Adventure[];
  offlineSince: Date | null;
  reloadFailure: ReactNode;
  onReload: () => Promise<void>;
}) {
  const t = useTexts();
  const planned = adventures.filter((a) => a.stage === 'planned');
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') void onReload();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };
  // A Live Adventure names the header after its destination; the overview takes the tab's name back.
  return (
    <Screen onRefresh={onReload}>
      <Stack.Screen options={{ title: t.adventure.title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t.adventure.plan} onPress={() => router.push('/plan')} />
      </Stack.Toolbar>
      {reloadFailure}
      {offlineSince && (
        <Note tone="warning" icon="wifi.slash">
          {`${t.adventure.noSignal} ${t.common.pullToRetry}`}
        </Note>
      )}
      <ThemedText themeColor="textSecondary">{t.adventure.intro}</ThemedText>
      {planned.length > 0 && (
        <ThemedText type="smallBold" mono>
          {t.adventure.planned}
        </ThemedText>
      )}
      {planned.map((a) => (
        <SwipeToDelete
          key={a.id}
          label={t.common.deleteLabel(a.plan.destination ?? t.adventure.fallbackName)}
          onDelete={() => void remove(a.id)}>
          <Pressable
            accessibilityRole="button"
            // A hint, not a label, so VoiceOver still reads the card's own lines.
            accessibilityHint={t.common.openLabel(a.plan.destination ?? t.adventure.fallbackName)}
            style={pressedStyle}
            onPress={() => router.push({ pathname: '/plan', params: { id: a.id } })}>
            <Section>
              <ThemedText type="smallBold">{a.plan.destination ?? t.adventure.noDestination}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {a.deadline ? t.adventure.backBy(t.when(a.deadline)) : t.adventure.noDeadline}
              </ThemedText>
            </Section>
          </Pressable>
        </SwipeToDelete>
      ))}
    </Screen>
  );
}

// A move must land after the current Deadline and in the future.
const movedDeadline = (deadline: Date, minutes: number) =>
  new Date(Math.max(deadline.getTime(), Date.now()) + minutes * 60_000);

function LiveAdventure({
  adventure: initial,
  offlineSince,
  queuedAt,
  reloadFailure,
  onChanged,
}: {
  adventure: InProgressAdventure;
  offlineSince: Date | null;
  queuedAt: Date | null;
  reloadFailure: ReactNode;
  onChanged: () => Promise<void>;
}) {
  const now = useNow();
  const t = useTexts();
  const theme = useTheme();
  const trailStatus = useTrailStatus(queuedAt);
  const trail = useLiveTrail(initial.id);
  const [adventure, setAdventure] = useState<Adventure>(initial);
  const [failures, setFailures] = useState<DeliveryFailure[]>([]);
  // The Deadline before the last move, shown in the card until the stage changes.
  const [movedFrom, setMovedFrom] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<Adventure['stage']>(initial.stage);

  useEffect(() => {
    stage.current = adventure.stage;
  }, [adventure]);
  // A move is old news once the stage changes.
  const apply = useCallback((next: Adventure) => {
    if (next.stage !== stage.current) setMovedFrom(null);
    setAdventure(next);
  }, []);
  useEffect(() => barry.watchAdventure(initial.id, apply), [initial.id, apply]);
  // The screen reloads on focus and on returning to the foreground; the live view must follow.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    if (initial.stage !== adventure.stage) setMovedFrom(null);
    setAdventure(initial);
  }
  useEffect(() => {
    let current = true;
    barry.deliveryFailures(initial.id).then(
      (next) => current && setFailures(next),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [initial.id, adventure]);

  const checkIn = async () => {
    setBusy(true);
    try {
      const result = await barry.checkIn(adventure.id);
      if (result.kind === 'ended') setAdventure(result.adventure);
      else void onChanged();
    } catch {
      // The Check-in is saved before it is sent, so the reload shows it as waiting.
      void onChanged();
    } finally {
      setBusy(false);
    }
  };

  // Hold to Check In sits in the tab bar's bottom accessory, which the tab bar draws while the Adventure tab shows.
  useOfferCheckIn(
    adventure.stage !== 'planned' && adventure.stage !== 'ended',
    busy,
    () => void checkIn(),
    queuedAt && { at: queuedAt, keepsTrying: trailStatus === 'delivering' },
  );

  if (adventure.stage === 'planned') return null;
  if (adventure.stage === 'ended') return <EndedAdventureScreen adventure={adventure} onDone={() => void onChanged()} />;

  const lastKnown = trail.at(-1) ?? adventure.lastKnownPosition;

  const move = async (minutes: number) => {
    setBusy(true);
    const result = await barry.moveDeadline(adventure.id, movedDeadline(adventure.deadline, minutes)).catch(() => null);
    setBusy(false);
    if (result?.kind === 'moved') {
      setMovedFrom(adventure.deadline);
      setAdventure(result.adventure);
    } else if (result?.kind === 'refused') {
      Alert.alert(t.adventure.notMovedTitle, refusalText(result.refusal));
    } else {
      Alert.alert(t.adventure.notMovedTitle, t.adventure.notMoved);
    }
  };

  return (
    <Screen onRefresh={onChanged}>
      <Stack.Screen options={{ title: adventure.plan.destination }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="clock" accessibilityLabel={t.adventure.needMoreTime} disabled={busy}>
          {t.adventure.moves.map((m) => (
            <Stack.Toolbar.MenuAction
              key={m.minutes}
              subtitle={t.when(movedDeadline(adventure.deadline, m.minutes))}
              onPress={() => void move(m.minutes)}>
              {m.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          icon="person.2"
          tintColor={failures.length > 0 ? theme.warning : undefined}
          accessibilityLabel={t.adventure.watchingTitle}
          onPress={() => router.push({ pathname: '/watching', params: { id: adventure.id } })}
        />
      </Stack.Toolbar>
      {offlineSince && (
        <Note tone="warning" icon="wifi.slash">
          {t.adventure.offline(t.when(offlineSince))}
        </Note>
      )}
      {reloadFailure}
      <DeadlineCard adventure={adventure} now={now} movedFrom={movedFrom} />

      {lastKnown ? (
        <View>
          <TrailMapView trail={trail} last={lastKnown} />
          {trailStatus && <TrailBadge status={trailStatus} />}
        </View>
      ) : (
        <>
          {trailStatus === 'recording' && <Note icon="location.fill">{t.adventure.recording}</Note>}
          {trailStatus === 'off' && <Note icon="location.slash">{t.adventure.trailOff}</Note>}
        </>
      )}

      <View style={styles.titledCard}>
        <GroupHeader title={t.adventure.planSection} />
        <Pressable
          accessibilityRole="button"
          accessibilityHint={adventure.stage === 'alerted' ? undefined : t.adventure.edit}
          disabled={adventure.stage === 'alerted'}
          style={pressedStyle}
          onPress={() => router.push({ pathname: '/plan', params: { id: adventure.id } })}>
          <Section>
            <ThemedText type="small">{t.adventure.destination(adventure.plan.destination)}</ThemedText>
            <ThemedText type="small">{t.adventure.deadline(t.when(adventure.deadline))}</ThemedText>
            {lastKnown && <ThemedText type="small">{t.adventure.lastKnown(t.when(lastKnown.takenAt))}</ThemedText>}
            <ThemedText type="small">{t.adventure.contacts(adventure.contacts.map((c) => c.name).join(', '))}</ThemedText>
          </Section>
          {adventure.stage !== 'alerted' && <Chevron />}
        </Pressable>
      </View>

      {failures.length > 0 && (
        <View style={styles.titledCard}>
          <GroupHeader title={t.adventure.failuresTitle} />
          <Section>
            {failures.map((f) => (
              <ThemedText key={f.id} type="small">
                {t.adventure.failure(f)}
              </ThemedText>
            ))}
          </Section>
        </View>
      )}
    </Screen>
  );
}

/**
 * The time that matters next, large: the Deadline while Barry watches, the Alert once overdue. Once alerted the card
 * says so in red. VoiceOver reads the whole sentence, and a move shows here as the Deadline it replaced.
 */
function DeadlineCard({ adventure, now, movedFrom }: { adventure: InProgressAdventure; now: Date; movedFrom: Date | null }) {
  const theme = useTheme();
  const t = useTexts();
  if (adventure.stage === 'alerted') {
    return (
      <View accessible accessibilityLabel={t.adventure.alerted(adventure.alertsSent)} style={[styles.card, { backgroundColor: `${theme.danger}1F` }]}>
        <ThemedText type="small" mono style={[styles.cardLabel, { color: theme.danger }]}>
          {t.adventure.alertedLabel.toUpperCase()}
        </ThemedText>
        <ThemedText mono style={styles.cardClock}>
          {`${adventure.alertsSent}/3`}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.text }}>
          {t.adventure.alerted(adventure.alertsSent)}
        </ThemedText>
      </View>
    );
  }
  const overdue = adventure.stage === 'overdue';
  const at = overdue ? adventure.alertAt : adventure.deadline;
  const left = t.duration(at.getTime() - now.getTime());
  const color = overdue ? theme.warning : theme.success;
  const otherDay = at.toDateString() !== now.toDateString();
  const said = overdue ? t.adventure.overdue(t.when(at), left) : t.adventure.watching(t.when(at), left);
  return (
    <View
      accessible
      accessibilityLabel={movedFrom ? `${said} ${t.adventure.movedFrom(t.when(movedFrom))}` : said}
      style={[styles.card, { backgroundColor: `${color}1F` }]}>
      <ThemedText type="small" mono style={[styles.cardLabel, { color }]}>
        {(overdue ? t.adventure.alertAt : t.adventure.checkInBy).toUpperCase()}
      </ThemedText>
      {otherDay && (
        <ThemedText mono style={styles.cardDay}>
          {t.day(at, now)}
        </ThemedText>
      )}
      <View style={styles.cardTime}>
        <ThemedText mono style={styles.cardClock}>
          {formatClock(at)}
        </ThemedText>
        <ThemedText mono style={[styles.cardLeft, { color }]}>
          {left}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.text }}>
        {overdue ? t.adventure.overdueNote : t.adventure.watchingNote}
      </ThemedText>
      {movedFrom && (
        <View style={styles.moved}>
          <SymbolView name="checkmark" size={13} weight="bold" tintColor={color} fallback={null} />
          <ThemedText type="small" style={{ color }}>
            {t.adventure.movedFrom(t.when(movedFrom))}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

/** What the Trail is doing, as a badge on the map it belongs to. */
function TrailBadge({ status }: { status: TrailStatus }) {
  const theme = useTheme();
  const t = useTexts();
  if (status !== 'recording' && status !== 'off') return null;
  const recording = status === 'recording';
  const color = recording ? theme.accent : theme.textSecondary;
  return (
    <View
      accessible
      accessibilityLabel={recording ? t.adventure.recording : t.adventure.trailOff}
      style={[styles.badge, { backgroundColor: `${theme.background}EB` }]}>
      <SymbolView name={recording ? 'location.fill' : 'location.slash'} size={13} tintColor={color} fallback={null} />
      <ThemedText type="small" style={[styles.badgeText, { color }]}>
        {recording ? t.adventure.recordingBadge : t.adventure.startOnlyBadge}
      </ThemedText>
    </View>
  );
}


const styles = StyleSheet.create({
  card: { borderRadius: 26, paddingHorizontal: 20, paddingVertical: 18, gap: 2 },
  cardLabel: { fontSize: 12, letterSpacing: 0.3 },
  cardDay: { fontSize: 17, lineHeight: 22, fontWeight: 500, marginTop: 4 },
  cardTime: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 12 },
  cardClock: { fontSize: 52, lineHeight: 62, fontWeight: 700 },
  cardLeft: { fontSize: 17, lineHeight: 22, fontWeight: 500 },
  moved: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  badge: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  titledCard: { gap: 6 },
  chevron: { position: 'absolute', right: Spacing.three, top: 0, bottom: 0, justifyContent: 'center' },
});

/** The Plan card's chevron: the card opens the Plan sheet while the Plan can still change. */
function Chevron() {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={styles.chevron}>
      <SymbolView
        name="chevron.right"
        size={14}
        weight="semibold"
        tintColor={theme.textSecondary}
        fallback={<ThemedText themeColor="textSecondary">›</ThemedText>}
      />
    </View>
  );
}

const TRAIL_REFRESH_MS = 5 * 60_000;

/** The Trail so far, growing with the readings that reach the server, so the Plan and the map agree. */
function useLiveTrail(id: AdventureId): Position[] {
  const [trail, setTrail] = useState<Position[]>([]);
  useEffect(() => {
    let mounted = true;
    let loading = false;
    let newest: Date | undefined;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const fresh = await barry.readings(id, newest);
        const last = fresh.at(-1);
        if (mounted && last) {
          newest = last.takenAt;
          setTrail((shown) => [...shown, ...fresh]);
        }
      } catch {
        // Keep what is shown, so losing signal does not blank the map.
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), TRAIL_REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [id]);
  return trail;
}
