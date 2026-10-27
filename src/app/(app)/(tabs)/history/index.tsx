import { router, Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Alert, type HostInstance, type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

import { FirstLoad, LoadState, Screen } from '@/components/form';
import { Group } from '@/components/grouped-list';
import { SelectionCircle } from '@/components/selection-circle';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { type Adventure, type AdventureId, barry, type EndedAdventure, type InProgressAdventure } from '@/lib/barry';
import { askToDeleteAdventure, askToDeleteAdventures } from '@/lib/delete-adventure';
import { byDay, type HistoryDay } from '@/lib/history-days';
import { useHideTabBar } from '@/lib/tab-bar';
import { type Texts, useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

const isInProgress = (a: Adventure): a is InProgressAdventure =>
  a.stage === 'active' || a.stage === 'overdue' || a.stage === 'alerted';

const isEnded = (a: Adventure): a is EndedAdventure => a.stage === 'ended';

// The server orders by when the Adventure was planned; History shows the newest Check-in first.
const endedNewestFirst = (adventures: Adventure[]) =>
  adventures.filter(isEnded).sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime());

const matches = (a: EndedAdventure, query: string) =>
  query === '' || a.plan.destination.toLocaleLowerCase().includes(query.toLocaleLowerCase());

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

const dayTitle = (day: HistoryDay<unknown>, t: Texts, now: Date) =>
  day.relative === 'today' ? t.history.today : day.relative === 'yesterday' ? t.history.yesterday : t.day(day.date, now);

const LONG_PRESS_MS = 300;
const SYMBOL = 32;
const SYMBOL_GAP = 12;
// Where the row separators start: at the text, past the status symbol.
const ROW_INSET = Spacing.three + SYMBOL + SYMBOL_GAP;
// The selection circles and the gap after them, where a drag selects without holding first.
const CIRCLES_WIDTH = ROW_INSET;

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
  list: RefObject<HostInstance | null>,
) {
  // Filled by index as rows lay out, so a row not laid out yet is a gap.
  const rows = useRef<({ top: number; bottom: number } | undefined)[]>([]);
  const latest = useRef({ ids, selected, selecting });
  useEffect(() => {
    latest.current = { ids, selected, selecting };
  });
  const drag = useRef<Drag | null>(null);
  // A drag selects from the row it touched first, not the one it has reached when it activates.
  const touchedY = useRef(0);

  const rowAt = (y: number) => {
    let row = 0;
    rows.current.forEach((r, i) => {
      if (r && i < latest.current.ids.length && y >= r.top) row = i;
    });
    return row;
  };
  // A tap in the gap between two rows toggles nothing; a drag counts the gap as the row above.
  const rowUnder = (y: number) =>
    rows.current.findIndex((r, i) => r && i < latest.current.ids.length && y >= r.top && y <= r.bottom);

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
    const id = current[anchor];
    drag.current = { anchor, select: id === undefined || !before.has(id), before };
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
      const id: AdventureId | undefined = current[rowUnder(e.y)];
      if (id === undefined) return;
      const next = new Set(shown);
      if (!next.delete(id)) next.add(id);
      setSelected(next);
    },
  });
  const gesture = useCompetingGestures(twoFingers, held);
  const circlesGesture = useCompetingGestures(alongCircles, tapCircle);

  // The rows sit inside their day's group, so each is measured against the whole list, where the gestures report.
  const measure = (row: number) => (event: LayoutChangeEvent) => {
    const target = event.currentTarget;
    const whole = list.current;
    if (typeof target === 'number' || !whole) return;
    target.measureLayout(whole, (_x, y, _width, height) => {
      rows.current[row] = { top: y, bottom: y + height };
    });
  };

  return { gesture, circlesGesture, measure };
}

/** A tinted circle with a symbol: what came of the Adventure, readable by its shape as well as its colour. */
function StatusSymbol({ name, color, fallback }: { name: SymbolViewProps['name']; color: ThemeColor; fallback: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.symbol, { backgroundColor: `${theme[color]}29` }]}>
      <SymbolView
        name={name}
        size={15}
        weight="bold"
        tintColor={theme[color]}
        fallback={<ThemedText style={{ color: theme[color], fontSize: 15 }}>{fallback}</ThemedText>}
      />
    </View>
  );
}

function Chevron() {
  const theme = useTheme();
  return (
    <SymbolView
      name="chevron.right"
      size={14}
      weight="semibold"
      tintColor={theme.textSecondary}
      fallback={<ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>}
    />
  );
}

/** One row of a day: the destination over what came of it, the time on the right, opaque so the swipe action shows only beside it. */
function Row({
  leading,
  title,
  line,
  warning,
  time,
  trailing,
}: {
  leading: React.ReactNode;
  title: string;
  line: string;
  warning: boolean;
  time?: string;
  trailing: boolean;
}) {
  return (
    <View style={styles.rowContent}>
      {leading}
      <View style={styles.text}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText themeColor={warning ? 'warning' : 'textSecondary'} style={styles.line}>
          {line}
        </ThemedText>
      </View>
      {time !== undefined && (
        <ThemedText mono themeColor="textSecondary" style={styles.time}>
          {time}
        </ThemedText>
      )}
      {trailing && <Chevron />}
    </View>
  );
}

export default function HistoryScreen() {
  const loaded = useLoad(() => barry.listAdventures());
  const t = useTexts();
  const theme = useTheme();
  const now = useNow();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<AdventureId>>(new Set());
  const [query, setQuery] = useState('');
  useHideTabBar(selecting);
  const ended = endedNewestFirst(loaded.data ?? []);
  const shown = ended.filter((a) => matches(a, query.trim()));
  const shownIds = shown.map((a) => a.id);
  const list = useRef<HostInstance>(null);
  const dragSelect = useDragSelect(shownIds, selected, setSelected, selecting, () => setSelecting(true), list);

  const search = (
    <Stack.Screen
      options={{
        headerSearchBarOptions: {
          placeholder: t.history.search,
          hideWhenScrolling: false,
          onChangeText: (event) => setQuery(event.nativeEvent.text),
          onCancelButtonPress: () => setQuery(''),
        },
      }}
    />
  );

  if (loaded.data === undefined) {
    return (
      <Screen>
        {search}
        <FirstLoad failure={loaded.error && t.common.couldNotReach} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }

  const inProgress = loaded.data.find(isInProgress);
  const remove = async (id: AdventureId) => {
    const outcome = await askToDeleteAdventure(id, 'ended');
    if (outcome.kind === 'deleted') void loaded.reload();
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
  const allSelected = shown.length > 0 && shown.every((a) => selected.has(a.id));
  const removeSelected = async () => {
    const outcome = await askToDeleteAdventures([...selected]);
    if (outcome.kind === 'cancelled') return;
    finishSelecting();
    void loaded.reload();
    if (outcome.failures.length > 0) {
      Alert.alert(t.history.notDeleted(outcome.failures.length), [...new Set(outcome.failures)].join('\n'));
    }
  };

  // Each row keeps its place in the whole list, which is what the drag selection counts in.
  let position = 0;
  const days = byDay(shown, (a) => a.checkedInAt, now).map((day) => ({
    ...day,
    rows: day.items.map((adventure) => ({ adventure, position: position++ })),
  }));

  const inProgressWarns = inProgress !== undefined && inProgress.stage !== 'active';

  return (
    <Screen onRefresh={loaded.reload}>
      {search}
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
          <Stack.Toolbar.Button onPress={() => setSelected(allSelected ? new Set() : new Set(shownIds))}>
            {allSelected ? t.history.deselectAll : t.history.selectAll}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button tintColor={theme.danger} disabled={selected.size === 0} onPress={() => void removeSelected()}>
            {t.history.deleteSelected(selected.size)}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      <LoadState loaded={loaded} failure={() => t.common.couldNotReach} />
      {!inProgress && ended.length === 0 && (
        <ThemedText themeColor="textSecondary">{t.history.empty}</ThemedText>
      )}
      {inProgress && (
        <Group title={t.history.current} inset={ROW_INSET}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${inProgress.plan.destination}, ${inProgressStatus(inProgress, t)}`}
            accessibilityHint={t.common.openLabel(inProgress.plan.destination)}
            // Leaving while selecting would keep the tab bar hidden with no Done to bring it back.
            onPress={() => {
              finishSelecting();
              router.navigate('/');
            }}
            style={({ pressed }) => ({ backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement })}>
            <Row
              leading={
                inProgressWarns ? (
                  <StatusSymbol name="exclamationmark.triangle.fill" color="warning" fallback="!" />
                ) : (
                  <StatusSymbol name="figure.hiking" color="accent" fallback="→" />
                )
              }
              title={inProgress.plan.destination}
              line={inProgressStatus(inProgress, t)}
              warning={inProgressWarns}
              trailing
            />
          </Pressable>
        </Group>
      )}
      {query.trim() !== '' && shown.length === 0 && ended.length > 0 && (
        <ThemedText themeColor="textSecondary">{t.history.noMatch}</ThemedText>
      )}
      <GestureDetector gesture={dragSelect.gesture}>
        <View ref={list} style={styles.list}>
          {days.map((day) => (
            <Group key={day.key} title={dayTitle(day, t, now)} inset={ROW_INSET}>
              {day.rows.map(({ adventure: a, position: i }) => {
                const alerted = a.alertsSent > 0;
                const time = formatClock(a.checkedInAt);
                const line = alerted ? t.ended.alertsSent(a.alertsSent) : t.history.checkedInShort;
                const label = `${a.plan.destination}, ${t.history.checkedIn(time)}${alerted ? t.history.alertsSent(a.alertsSent) : ''}`;
                return (
                  <View key={a.id} onLayout={dragSelect.measure(i)}>
                    {selecting ? (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={label}
                        accessibilityState={{ checked: selected.has(a.id) }}
                        onPress={() => toggle(a.id)}
                        style={{ backgroundColor: theme.backgroundElement }}>
                        <Row
                          leading={
                            <View style={styles.symbol}>
                              <SelectionCircle selected={selected.has(a.id)} />
                            </View>
                          }
                          title={a.plan.destination}
                          line={line}
                          warning={alerted}
                          time={time}
                          trailing={false}
                        />
                      </Pressable>
                    ) : (
                      <SwipeToDelete flush label={t.common.deleteLabel(a.plan.destination)} onDelete={() => void remove(a.id)}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityHint={t.common.openLabel(a.plan.destination)}
                          onPress={() => router.push({ pathname: '/history/[id]', params: { id: a.id } })}
                          style={({ pressed }) => ({ backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement })}>
                          <Row
                            leading={
                              alerted ? (
                                <StatusSymbol name="exclamationmark.triangle.fill" color="warning" fallback="!" />
                              ) : (
                                <StatusSymbol name="checkmark" color="success" fallback="✓" />
                              )
                            }
                            title={a.plan.destination}
                            line={line}
                            warning={alerted}
                            time={time}
                            trailing
                          />
                        </Pressable>
                      </SwipeToDelete>
                    )}
                  </View>
                );
              })}
            </Group>
          ))}
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
  list: { gap: Spacing.four },
  circles: { position: 'absolute', left: 0, top: 0, bottom: 0, width: CIRCLES_WIDTH },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: SYMBOL_GAP, minHeight: 64, paddingHorizontal: Spacing.three },
  symbol: { width: SYMBOL, height: SYMBOL, borderRadius: SYMBOL / 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, paddingVertical: 10 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  line: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
  time: { fontSize: 15, lineHeight: 20, fontWeight: 500 },
  chevron: { fontSize: 22 },
});
