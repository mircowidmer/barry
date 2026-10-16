import { router } from 'expo-router';
import { Alert, Pressable } from 'react-native';

import { Button, Notice, Screen, Section } from '@/components/form';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type Adventure, type AdventureId, barry, type EndedAdventure, type InProgressAdventure } from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { type Texts, useTexts } from '@/lib/texts';

const isInProgress = (a: Adventure): a is InProgressAdventure =>
  a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted';

const isEnded = (a: Adventure): a is EndedAdventure => a.stage === 'ended';

const inProgressStatus = (a: InProgressAdventure, t: Texts) => {
  switch (a.stage) {
    case 'active':
      return t.adventure.backBy(t.when(a.deadline));
    case 'overdue':
      return t.history.overdueSince(t.when(a.deadline));
    case 'alerted':
      return t.history.alerted;
  }
};

export default function HistoryScreen() {
  const loaded = useLoad(() => barry.listAdventures());
  const t = useTexts();

  if (loaded.status === 'error') {
    return (
      <Screen title={t.history.title}>
        <Notice tone="danger">{t.common.couldNotReach(loaded.error.message)}</Notice>
        <Button title={t.common.tryAgain} onPress={loaded.reload} />
      </Screen>
    );
  }
  if (!loaded.data) return <Screen title={t.history.title}>{null}</Screen>;

  const inProgress = loaded.data.find(isInProgress);
  const ended = loaded.data.filter(isEnded);
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'ended');
    if (outcome.kind === 'deleted') loaded.reload();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };

  return (
    <Screen title={t.history.title}>
      {!inProgress && ended.length === 0 && (
        <ThemedText themeColor="textSecondary">{t.history.empty}</ThemedText>
      )}
      {inProgress && (
        <>
          <ThemedText type="smallBold">{t.history.current}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.openLabel(inProgress.plan.destination)}
            onPress={() => router.navigate('/')}>
            <Section>
              <ThemedText type="smallBold">{inProgress.plan.destination}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {inProgressStatus(inProgress, t)}
              </ThemedText>
            </Section>
          </Pressable>
        </>
      )}
      {ended.length > 0 && <ThemedText type="smallBold">{t.history.past}</ThemedText>}
      {ended.map((a) => (
        <SwipeToDelete key={a.id} label={t.common.deleteLabel(a.plan.destination)} onDelete={() => remove(a.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.openLabel(a.plan.destination)}
            onPress={() => router.push({ pathname: '/adventure/[id]', params: { id: a.id } })}>
            <Section>
              <ThemedText type="smallBold">{a.plan.destination}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.history.checkedIn(t.when(a.checkedInAt))}
                {a.alertsSent > 0 && t.history.alertsSent(a.alertsSent)}
              </ThemedText>
            </Section>
          </Pressable>
        </SwipeToDelete>
      ))}
    </Screen>
  );
}
