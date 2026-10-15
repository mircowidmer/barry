import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { EndedAdventureScreen } from '@/components/ended-adventure-screen';
import { Button, HoldButton, Notice, Row, Screen, Section } from '@/components/form';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useTrailStatus } from '@/hooks/use-trail-status';
import { type Adventure, type AdventureId, barry, type DeliveryFailure, type InProgressAdventure } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { formatDuration, formatWhen, refusalText } from '@/lib/wording';

export default function AdventureScreen() {
  const loaded = useLoad(async () => {
    const { adventure: inProgress, offlineSince } = await barry.getInProgressAdventure();
    const adventures = inProgress || offlineSince ? [] : await barry.listAdventures();
    return { inProgress, offlineSince, adventures, pending: barry.pendingCheckIns() };
  });

  if (loaded.status === 'error') {
    return (
      <Screen title="Adventure">
        <Notice tone="danger">Could not reach Barry. {loaded.error.message}</Notice>
        <Button title="Try again" onPress={loaded.reload} />
      </Screen>
    );
  }
  if (!loaded.data) return <Screen title="Adventure">{null}</Screen>;

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
  const planned = adventures.filter((a) => a.stage === 'planned');
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') onReload();
    else if (outcome.kind === 'failed') Alert.alert('Could not delete', outcome.message);
  };
  return (
    <Screen title="Adventure">
      {offlineSince && (
        <>
          <Notice tone="warning">No signal. Barry cannot load your Adventures right now.</Notice>
          <Button title="Try again" kind="secondary" onPress={onReload} />
        </>
      )}
      <ThemedText themeColor="textSecondary">
        Plan where you are going and when you will be back. If you don’t check in by then, Barry tells your Emergency
        Contacts.
      </ThemedText>
      <Button title="Plan an Adventure" onPress={() => router.push('/plan')} />
      {planned.length > 0 && <ThemedText type="smallBold">Planned Adventures</ThemedText>}
      {planned.map((a) => (
        <SwipeToDelete
          key={a.id}
          label={`Delete ${a.plan.destination ?? 'Adventure'}`}
          onDelete={() => remove(a.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${a.plan.destination ?? 'Adventure'}`}
            onPress={() => router.push({ pathname: '/plan', params: { id: a.id } })}>
            <Section>
              <ThemedText type="smallBold">{a.plan.destination ?? 'No destination yet'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {a.deadline ? `Back by ${formatWhen(a.deadline)}` : 'No Deadline yet'}
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

const MOVES = [
  { label: '+30 min', minutes: 30 },
  { label: '+1 hour', minutes: 60 },
  { label: '+2 hours', minutes: 120 },
];

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
  const trail = useTrailStatus(queuedAt);
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

  const move = async (minutes: number) => {
    setBusy(true);
    const result = await barry.moveDeadline(adventure.id, movedDeadline(adventure.deadline, minutes)).catch(() => null);
    setBusy(false);
    if (result?.kind === 'moved') {
      setAdventure(result.adventure);
      setNotice({ tone: 'success', text: `New Deadline: ${formatWhen(result.adventure.deadline)}.` });
    } else if (result?.kind === 'refused') {
      setNotice({ tone: 'danger', text: refusalText(result.refusal) });
    } else {
      setNotice({ tone: 'warning', text: 'No confirmation from Barry. Your Deadline has not moved. Try again when you have signal.' });
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
    <Screen title={adventure.plan.destination}>
      {adventure.stage === 'active' && (
        <Notice tone="success">
          Barry is watching. Check in by {formatWhen(adventure.deadline)}, in {formatDuration(adventure.deadline.getTime() - now.getTime())}.
        </Notice>
      )}
      {adventure.stage === 'overdue' && (
        <Notice tone="warning">
          You are overdue. Barry alerts your Emergency Contacts at {formatWhen(adventure.alertAt)}, in{' '}
          {formatDuration(adventure.alertAt.getTime() - now.getTime())}, unless you check in.
        </Notice>
      )}
      {adventure.stage === 'alerted' && (
        <Notice tone="danger">
          Your Emergency Contacts were alerted ({adventure.alertsSent} of 3). Check in to send them the All-clear.
        </Notice>
      )}
      {offlineSince && (
        <Notice tone="warning">
          No signal. This is your Adventure as of {formatWhen(offlineSince)}. Check-in still works and is sent when you
          have signal.
        </Notice>
      )}
      {trail === 'recording' && <Notice>Barry is recording your Trail. Closing Barry stops the Trail.</Notice>}
      {trail === 'off' && <Notice>Barry can share only where you started.</Notice>}
      {queuedAt && (
        <Notice tone="warning">
          Check-in from {formatWhen(queuedAt)} is waiting for signal.
          {trail === 'delivering' && ' Barry keeps trying in the background.'}
        </Notice>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <HoldButton title="Hold to check in" onComplete={checkIn} />

      {adventure.stage !== 'alerted' && (
        <Section title="Need more time?">
          <Row>
            {MOVES.map((m) => (
              <Button key={m.minutes} title={m.label} kind="secondary" busy={busy} onPress={() => move(m.minutes)} />
            ))}
          </Row>
        </Section>
      )}

      <Section title="Plan">
        <ThemedText type="small">Destination: {adventure.plan.destination}</ThemedText>
        {adventure.plan.route && <ThemedText type="small">Route: {adventure.plan.route}</ThemedText>}
        {adventure.plan.startingPoint && <ThemedText type="small">Starting point: {adventure.plan.startingPoint}</ThemedText>}
        {adventure.plan.notes && <ThemedText type="small">Notes: {adventure.plan.notes}</ThemedText>}
        <ThemedText type="small">Deadline: {formatWhen(adventure.deadline)}</ThemedText>
        {adventure.lastKnownPosition && (
          <ThemedText type="small">Last position: {formatWhen(adventure.lastKnownPosition.takenAt)}</ThemedText>
        )}
        <ThemedText type="small">Contacts: {adventure.contacts.map((c) => c.name).join(', ')}</ThemedText>
        {adventure.stage !== 'alerted' && (
          <Button
            title="Edit Plan or contacts"
            kind="secondary"
            onPress={() => router.push({ pathname: '/plan', params: { id: adventure.id } })}
          />
        )}
      </Section>

      {failures.length > 0 && (
        <Section title="Messages that did not arrive">
          {failures.map((f, i) => (
            <ThemedText key={i} type="small">
              {f.contactName}: {f.message.replace('_', '-')} by {f.channel === 'sms' ? 'text message' : f.channel}
              {f.reason === 'channel_not_enabled' ? ' (text messages are not set up yet)' : ` (${f.reason})`}
            </ThemedText>
          ))}
        </Section>
      )}
    </Screen>
  );
}
