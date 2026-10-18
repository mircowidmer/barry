import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { EndedAdventureScreen } from '@/components/ended-adventure-screen';
import { Button, HoldButton, Notice, Row, Screen, Section } from '@/components/form';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { TrailMapView } from '@/components/trail-map-view';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useTrailStatus } from '@/hooks/use-trail-status';
import { type Adventure, type AdventureId, barry, type DeliveryFailure, type InProgressAdventure, type Position } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { refusalText, useTexts } from '@/lib/texts';

export default function AdventureScreen() {
  const loaded = useLoad(async () => {
    const { adventure: inProgress, offlineSince } = await barry.getInProgressAdventure();
    const adventures = inProgress || offlineSince ? [] : await barry.listAdventures();
    return { inProgress, offlineSince, adventures, pending: barry.pendingCheckIns() };
  });
  const t = useTexts();

  if (loaded.status === 'error') {
    return (
      <Screen>
        <Notice tone="danger">{t.common.couldNotReach(loaded.error.message)}</Notice>
        <Button title={t.common.tryAgain} onPress={loaded.reload} />
      </Screen>
    );
  }
  if (!loaded.data) return <Screen>{null}</Screen>;

  const { inProgress, offlineSince, adventures, pending } = loaded.data;
  const queued = inProgress && pending.find((c) => c.adventureId === inProgress.id);

  return inProgress ? (
    <LiveAdventure
      key={inProgress.id}
      adventure={inProgress}
      offlineSince={offlineSince}
      queuedAt={queued?.checkedInAt ?? null}
      onChanged={loaded.reload}
    />
  ) : (
    <Overview adventures={adventures} offlineSince={offlineSince} onReload={loaded.reload} />
  );
}

function Overview({
  adventures,
  offlineSince,
  onReload,
}: {
  adventures: Adventure[];
  offlineSince: Date | null;
  onReload: () => void;
}) {
  const t = useTexts();
  const planned = adventures.filter((a) => a.stage === 'planned');
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') onReload();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };
  // A Live Adventure names the header after its destination; the overview takes the tab's name back.
  return (
    <Screen>
      <Stack.Screen options={{ title: t.adventure.title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t.adventure.plan} onPress={() => router.push('/plan')} />
      </Stack.Toolbar>
      {offlineSince && (
        <>
          <Notice tone="warning">{t.adventure.noSignal}</Notice>
          <Button title={t.common.tryAgain} kind="secondary" onPress={onReload} />
        </>
      )}
      <ThemedText themeColor="textSecondary">{t.adventure.intro}</ThemedText>
      {planned.length > 0 && <ThemedText type="smallBold">{t.adventure.planned}</ThemedText>}
      {planned.map((a) => (
        <SwipeToDelete
          key={a.id}
          label={t.common.deleteLabel(a.plan.destination ?? t.adventure.fallbackName)}
          onDelete={() => remove(a.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.openLabel(a.plan.destination ?? t.adventure.fallbackName)}
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
  onChanged,
}: {
  adventure: InProgressAdventure;
  offlineSince: Date | null;
  queuedAt: Date | null;
  onChanged: () => void;
}) {
  const now = useNow();
  const t = useTexts();
  const trailStatus = useTrailStatus(queuedAt);
  const trail = useLiveTrail(initial.id);
  const [adventure, setAdventure] = useState<Adventure>(initial);
  const [failures, setFailures] = useState<DeliveryFailure[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<Adventure['stage']>(initial.stage);

  useEffect(() => {
    stage.current = adventure.stage;
  }, [adventure]);
  useEffect(
    () =>
      barry.watchAdventure(initial.id, (next) => {
        if (next.stage !== stage.current) setNotice(null);
        setAdventure(next);
      }),
    [initial.id],
  );
  useEffect(() => {
    barry.deliveryFailures(initial.id).then(setFailures, () => undefined);
  }, [initial.id, adventure]);

  if (adventure.stage === 'planned') return null;
  if (adventure.stage === 'ended') return <EndedAdventureScreen adventure={adventure} onDone={onChanged} />;

  const lastKnown = trail.at(-1) ?? adventure.lastKnownPosition;

  const move = async (minutes: number) => {
    setBusy(true);
    const result = await barry.moveDeadline(adventure.id, movedDeadline(adventure.deadline, minutes)).catch(() => null);
    setBusy(false);
    if (result?.kind === 'moved') {
      setAdventure(result.adventure);
      setNotice({ tone: 'success', text: t.adventure.newDeadline(t.when(result.adventure.deadline)) });
    } else if (result?.kind === 'refused') {
      setNotice({ tone: 'danger', text: refusalText(result.refusal) });
    } else {
      setNotice({ tone: 'warning', text: t.adventure.notMoved });
    }
  };

  const checkIn = async () => {
    setBusy(true);
    const result = await barry.checkIn(adventure.id);
    setBusy(false);
    if (result.kind === 'ended') setAdventure(result.adventure);
    else onChanged();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: adventure.plan.destination }} />
      {adventure.stage === 'active' && (
        <Notice tone="success">
          {t.adventure.watching(t.when(adventure.deadline), t.duration(adventure.deadline.getTime() - now.getTime()))}
        </Notice>
      )}
      {adventure.stage === 'overdue' && (
        <Notice tone="warning">
          {t.adventure.overdue(t.when(adventure.alertAt), t.duration(adventure.alertAt.getTime() - now.getTime()))}
        </Notice>
      )}
      {adventure.stage === 'alerted' && (
        <Notice tone="danger">{t.adventure.alerted(adventure.alertsSent)}</Notice>
      )}
      {offlineSince && (
        <Notice tone="warning">{t.adventure.offline(t.when(offlineSince))}</Notice>
      )}
      {trailStatus === 'recording' && <Notice>{t.adventure.recording}</Notice>}
      {trailStatus === 'off' && <Notice>{t.adventure.trailOff}</Notice>}
      {queuedAt && (
        <Notice tone="warning">
          {t.adventure.queued(t.when(queuedAt))}
          {trailStatus === 'delivering' && t.adventure.keepsTrying}
        </Notice>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <HoldButton title={t.adventure.hold} onComplete={checkIn} />

      {adventure.stage !== 'alerted' && (
        <Section title={t.adventure.needMoreTime}>
          <Row>
            {t.adventure.moves.map((m) => (
              <Button key={m.minutes} title={m.label} kind="secondary" busy={busy} onPress={() => move(m.minutes)} />
            ))}
          </Row>
        </Section>
      )}

      <Section title={t.adventure.planSection}>
        <ThemedText type="small">{t.adventure.destination(adventure.plan.destination)}</ThemedText>
        {adventure.plan.route && <ThemedText type="small">{t.adventure.route(adventure.plan.route)}</ThemedText>}
        <ThemedText type="small">{t.adventure.deadline(t.when(adventure.deadline))}</ThemedText>
        {lastKnown && <ThemedText type="small">{t.adventure.lastKnown(t.when(lastKnown.takenAt))}</ThemedText>}
        <ThemedText type="small">{t.adventure.contacts(adventure.contacts.map((c) => c.name).join(', '))}</ThemedText>
        {adventure.stage !== 'alerted' && (
          <Button
            title={t.adventure.edit}
            kind="secondary"
            onPress={() => router.push({ pathname: '/plan', params: { id: adventure.id } })}
          />
        )}
      </Section>

      {trail.length > 0 && <TrailMapView trail={trail} last={trail.at(-1)!} />}

      {failures.length > 0 && (
        <Section title={t.adventure.failuresTitle}>
          {failures.map((f, i) => (
            <ThemedText key={i} type="small">
              {t.adventure.failure(f)}
            </ThemedText>
          ))}
        </Section>
      )}
    </Screen>
  );
}

const TRAIL_REFRESH_MS = 60_000;

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
        if (mounted && fresh.length > 0) {
          newest = fresh.at(-1)!.takenAt;
          setTrail((shown) => [...shown, ...fresh]);
        }
      } catch {
        // Keep what is shown, so losing signal does not blank the map.
      } finally {
        loading = false;
      }
    };
    load();
    const timer = setInterval(load, TRAIL_REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [id]);
  return trail;
}
