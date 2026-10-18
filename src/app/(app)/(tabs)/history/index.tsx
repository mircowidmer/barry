import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { Button, Notice, Screen, Section } from '@/components/form';
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

function SelectionMark({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.mark,
        selected ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.textSecondary },
      ]}>
      {selected && <ThemedText style={[styles.check, { color: theme.onAccent }]}>✓</ThemedText>}
    </View>
  );
}

const LONG_PRESS_MS = 300;

/**
 * Press and hold a row, then drag over others to select every row in between, as in Photos.
 * The first row decides whether the drag selects or deselects.
 */
function useDragSelect(
  ids: AdventureId[],
  selected: Set<AdventureId>,
  setSelected: (next: Set<AdventureId>) => void,
  enabled: boolean,
) {
  const rowTops = useRef<number[]>([]);
  const latest = useRef({ ids, selected });
  useEffect(() => {
    latest.current = { ids, selected };
  });
  const drag = useRef<{ anchor: number; select: boolean; before: Set<AdventureId> } | null>(null);

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

  const gesture = usePanGesture({
    enabled,
    activateAfterLongPress: LONG_PRESS_MS,
    runOnJS: true,
    onActivate: (e) => {
      const anchor = rowAt(e.y);
      const { ids: current, selected: before } = latest.current;
      drag.current = { anchor, select: !before.has(current[anchor]), before };
      extendTo(anchor);
    },
    onUpdate: (e) => extendTo(rowAt(e.y)),
    onFinalize: () => {
      drag.current = null;
    },
  });

  const measure = (row: number) => (e: { nativeEvent: { layout: { y: number } } }) => {
    rowTops.current[row] = e.nativeEvent.layout.y;
  };

  return { gesture, measure };
}

export default function HistoryScreen() {
  const loaded = useLoad(() => barry.listAdventures());
  const t = useTexts();
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<AdventureId>>(new Set());
  useHideTabBar(selecting);
  const endedIds = (loaded.data ?? []).filter(isEnded).map((a) => a.id);
  const dragSelect = useDragSelect(endedIds, selected, setSelected, selecting);

  if (loaded.status === 'error') {
    return (
      <Screen>
        <Notice tone="danger">{t.common.couldNotReach(loaded.error.message)}</Notice>
        <Button title={t.common.tryAgain} onPress={loaded.reload} />
      </Screen>
    );
  }
  if (!loaded.data) return <Screen>{null}</Screen>;

  const inProgress = loaded.data.find(isInProgress);
  const ended = loaded.data.filter(isEnded);
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
    <Screen>
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
            return selecting ? (
              <Pressable
                key={a.id}
                accessibilityRole="checkbox"
                accessibilityLabel={a.plan.destination}
                accessibilityState={{ checked: selected.has(a.id) }}
                onPress={() => toggle(a.id)}
                onLayout={dragSelect.measure(i)}
                style={styles.selectable}>
                <SelectionMark selected={selected.has(a.id)} />
                <View style={styles.selectableCard}>{card}</View>
              </Pressable>
            ) : (
              <SwipeToDelete key={a.id} label={t.common.deleteLabel(a.plan.destination)} onDelete={() => remove(a.id)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.common.openLabel(a.plan.destination)}
                  onPress={() => router.push({ pathname: '/history/[id]', params: { id: a.id } })}>
                  {card}
                </Pressable>
              </SwipeToDelete>
            );
          })}
        </View>
      </GestureDetector>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  selectable: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectableCard: { flex: 1 },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 14, fontWeight: 700, lineHeight: 18 },
});
