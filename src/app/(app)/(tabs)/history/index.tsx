import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

import { Button, Loading, Notice, pressedStyle, Screen, Section } from '@/components/form';
import { SelectionCircle } from '@/components/selection-circle';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { type Adventure, type AdventureId, barry, type EndedAdventure, type InProgressAdventure } from '@/lib/barry';
import { askToDeleteAdventure, askToDeleteAdventures } from '@/lib/delete-adventure';
import { useHideTabBar } from '@/lib/tab-bar';
import { type Texts, useTexts } from '@/lib/texts';

const isInProgress = (a: Adventure): a is InProgressAdventure =>
  a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted';

const isEnded = (a: Adventure): a is EndedAdventure => a.stage === 'ended';

// The server orders by when the Adventure was planned; History shows the newest Check-in first.
const endedNewestFirst = (adventures: Adventure[]) =>
  adventures.filter(isEnded).sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime());

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

const LONG_PRESS_MS = 300;
// The selection circles and the gap after them, where a drag selects without holding first.
const CIRCLES_WIDTH = 48;

type Drag = { anchor: number; select: boolean; before: Set<AdventureId> };

/**
 * Selects many rows in one drag, as in Mail: two fingers over the list start selecting, and while
 * selecting, one finger down the circles or a held row extends the selection. The first row decides
 * whether the drag selects or deselects.
 */
function useDragSelect(
  ids: AdventureId[],
  selected: Set<AdventureId>,
  setSelected: (next: Set<AdventureId>) => void,
  selecting: boolean,
  startSelecting: () => void,
) {
  const rowTops = useRef<number[]>([]);
  const latest = useRef({ ids, selected, selecting });
  useEffect(() => {
    latest.current = { ids, selected, selecting };
  });
  const drag = useRef<Drag | null>(null);
  // A drag selects from the row it touched first, not the one it has reached when it activates.
  const touchedY = useRef(0);

  const rowAt = (y: number) => {
    let row = 0;
    rowTops.current.forEach((top, i) => {
      if (i < latest.current.ids.length && y >= top) row = i;
    });
    return row;
  };

  const extendTo = (row: number) => {
    const d = drag.current;
    if (!d) return;
    const next = new Set(d.before);
    for (const id of latest.current.ids.slice(Math.min(d.anchor, row), Math.max(d.anchor, row) + 1)) {
      if (d.select) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  };

  const begin = (y: number) => {
    const anchor = rowAt(y);
    const { ids: current, selected: shown, selecting: already } = latest.current;
    if (!already) startSelecting();
    const before = already ? shown : new Set<AdventureId>();
    drag.current = { anchor, select: !before.has(current[anchor]), before };
    extendTo(anchor);
  };

  const end = () => {
    drag.current = null;
  };

  const held = usePanGesture({
    enabled: selecting,
    activateAfterLongPress: LONG_PRESS_MS,
    // Moving before the hold completes is a scroll, not a selection.
    failOffsetX: [-10, 10],
    failOffsetY: [-10, 10],
    runOnJS: true,
    onBegin: (e) => {
      touchedY.current = e.y;
    },
    onActivate: () => begin(touchedY.current),
    onUpdate: (e) => extendTo(rowAt(e.y)),
    onFinalize: end,
  });
  const alongCircles = usePanGesture({
    activeOffsetY: [-8, 8],
    failOffsetX: [-20, 20],
    runOnJS: true,
    onBegin: (e) => {
      touchedY.current = e.y;
    },
    onActivate: () => begin(touchedY.current),
    onUpdate: (e) => extendTo(rowAt(e.y)),
    onFinalize: end,
  });
  const twoFingers = usePanGesture({
    minPointers: 2,
    activeOffsetY: [-10, 10],
    runOnJS: true,
    onBegin: (e) => {
      touchedY.current = e.y;
    },
    onActivate: () => begin(touchedY.current),
    onUpdate: (e) => extendTo(rowAt(e.y)),
    onFinalize: end,
  });
  const tapCircle = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      const { ids: current, selected: shown } = latest.current;
      const id = current[rowAt(e.y)];
      const next = new Set(shown);
      if (!next.delete(id)) next.add(id);
      setSelected(next);
    },
  });
  const gesture = useCompetingGestures(twoFingers, held);
  const circlesGesture = useCompetingGestures(alongCircles, tapCircle);

  const measure = (row: number) => (e: { nativeEvent: { layout: { y: number } } }) => {
    rowTops.current[row] = e.nativeEvent.layout.y;
  };

  return { gesture, circlesGesture, measure };
}

export default function HistoryScreen() {
  const loaded = useLoad(() => barry.listAdventures());
  const t = useTexts();
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<AdventureId>>(new Set());
  useHideTabBar(selecting);
  const ended = endedNewestFirst(loaded.data ?? []);
  const endedIds = ended.map((a) => a.id);
  const dragSelect = useDragSelect(endedIds, selected, setSelected, selecting, () => setSelecting(true));

  if (loaded.data === undefined) {
    return (
      <Screen>
        {loaded.status === 'error' ? (
          <>
            <Notice tone="danger">{t.common.couldNotReach(loaded.error.message)}</Notice>
            <Button title={t.common.tryAgain} onPress={loaded.reload} />
          </>
        ) : (
          <Loading />
        )}
      </Screen>
    );
  }

  const inProgress = loaded.data.find(isInProgress);
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'ended');
    if (outcome.kind === 'deleted') loaded.reload();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
  };

  const finishSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (id: AdventureId) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allSelected = ended.length > 0 && selected.size === ended.length;
  const removeSelected = async () => {
    const outcome = await askToDeleteAdventures([...selected]);
    if (outcome.kind === 'cancelled') return;
    finishSelecting();
    loaded.reload();
    if (outcome.failures.length > 0) {
      Alert.alert(t.history.notDeleted(outcome.failures.length), [...new Set(outcome.failures)].join('\n'));
    }
  };

  return (
    <Screen onRefresh={loaded.reload}>
      {ended.length > 0 && (
        <Stack.Toolbar placement="right">
          {selecting ? (
            <Stack.Toolbar.Button variant="done" onPress={finishSelecting}>
              {t.common.done}
            </Stack.Toolbar.Button>
          ) : (
            <Stack.Toolbar.Button onPress={() => setSelecting(true)}>{t.history.select}</Stack.Toolbar.Button>
          )}
        </Stack.Toolbar>
      )}
      {selecting && (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button onPress={() => setSelected(allSelected ? new Set() : new Set(ended.map((a) => a.id)))}>
            {allSelected ? t.history.deselectAll : t.history.selectAll}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button tintColor={theme.danger} disabled={selected.size === 0} onPress={removeSelected}>
            {t.history.deleteSelected(selected.size)}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      {!inProgress && ended.length === 0 && (
        <ThemedText themeColor="textSecondary">{t.history.empty}</ThemedText>
      )}
      {inProgress && (
        <>
          <ThemedText type="smallBold">{t.history.current}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t.common.openLabel(inProgress.plan.destination)}
            style={pressedStyle}
            // Leaving while selecting would keep the tab bar hidden with no Done to bring it back.
            onPress={() => {
              finishSelecting();
              router.navigate('/');
            }}>
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
      <GestureDetector gesture={dragSelect.gesture}>
        <View style={styles.list}>
          {ended.map((a, i) => {
            const card = (
              <Section>
                <ThemedText type="smallBold">{a.plan.destination}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.history.checkedIn(t.when(a.checkedInAt))}
                  {a.alertsSent > 0 && t.history.alertsSent(a.alertsSent)}
                </ThemedText>
              </Section>
            );
            return (
              <View key={a.id} onLayout={dragSelect.measure(i)}>
                {selecting ? (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={a.plan.destination}
                    accessibilityState={{ checked: selected.has(a.id) }}
                    onPress={() => toggle(a.id)}
                    style={styles.selectable}>
                    <SelectionCircle selected={selected.has(a.id)} />
                    <View style={styles.selectableCard}>{card}</View>
                  </Pressable>
                ) : (
                  <SwipeToDelete label={t.common.deleteLabel(a.plan.destination)} onDelete={() => remove(a.id)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityHint={t.common.openLabel(a.plan.destination)}
                      style={pressedStyle}
                      onPress={() => router.push({ pathname: '/history/[id]', params: { id: a.id } })}>
                      {card}
                    </Pressable>
                  </SwipeToDelete>
                )}
              </View>
            );
          })}
          {selecting && (
            <GestureDetector gesture={dragSelect.circlesGesture}>
              <View style={styles.circles} />
            </GestureDetector>
          )}
        </View>
      </GestureDetector>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  circles: { position: 'absolute', left: 0, top: 0, bottom: 0, width: CIRCLES_WIDTH },
  selectable: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectableCard: { flex: 1 },
});
