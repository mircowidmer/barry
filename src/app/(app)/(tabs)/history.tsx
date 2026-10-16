import { router } from 'expo-router';
import { Alert, Pressable } from 'react-native';

import { Button, Notice, Screen, Section } from '@/components/form';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type Adventure, type AdventureId, barry, type EndedAdventure, type InProgressAdventure } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { formatWhen } from '@/lib/wording';

const isInProgress = (a: Adventure): a is InProgressAdventure =>
  a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted';

const isEnded = (a: Adventure): a is EndedAdventure => a.stage === 'ended';

const inProgressStatus = (a: InProgressAdventure) => {
  switch (a.stage) {
    case 'active':
      return `Back by ${formatWhen(a.deadline)}`;
    case 'overdue':
      return `Overdue since ${formatWhen(a.deadline)}`;
    case 'alerted':
      return 'Emergency Contacts alerted';
  }
};

export default function HistoryScreen() {
  const loaded = useLoad(() => barry.listAdventures());

  if (loaded.status === 'error') {
    return (
      <Screen title="History">
        <Notice tone="danger">Could not reach Barry. {loaded.error.message}</Notice>
        <Button title="Try again" onPress={loaded.reload} />
      </Screen>
    );
  }
  if (!loaded.data) return <Screen title="History">{null}</Screen>;

  const inProgress = loaded.data.find(isInProgress);
  const ended = loaded.data.filter(isEnded);
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'ended');
    if (outcome.kind === 'deleted') loaded.reload();
    else if (outcome.kind === 'failed') Alert.alert('Could not delete', outcome.message);
  };

  return (
    <Screen title="History">
      {!inProgress && ended.length === 0 && (
        <ThemedText themeColor="textSecondary">Your adventures show up here once you start one.</ThemedText>
      )}
      {inProgress && (
        <>
          <ThemedText type="smallBold">Current Adventure</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${inProgress.plan.destination}`}
            onPress={() => router.navigate('/')}>
            <Section>
              <ThemedText type="smallBold">{inProgress.plan.destination}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {inProgressStatus(inProgress)}
              </ThemedText>
            </Section>
          </Pressable>
        </>
      )}
      {ended.length > 0 && <ThemedText type="smallBold">Past Adventures</ThemedText>}
      {ended.map((a) => (
        <SwipeToDelete key={a.id} label={`Delete ${a.plan.destination}`} onDelete={() => remove(a.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${a.plan.destination}`}
            onPress={() => router.push({ pathname: '/adventure/[id]', params: { id: a.id } })}>
            <Section>
              <ThemedText type="smallBold">{a.plan.destination}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Checked in {formatWhen(a.checkedInAt)}
                {a.alertsSent > 0 && ` · ${a.alertsSent} Alert${a.alertsSent > 1 ? 's' : ''} sent`}
              </ThemedText>
            </Section>
          </Pressable>
        </SwipeToDelete>
      ))}
    </Screen>
  );
}
