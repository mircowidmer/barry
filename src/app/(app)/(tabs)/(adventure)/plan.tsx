import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { DestinationMap, type MapCamera } from '@/components/destination-map';
import { Button, Field, FirstLoad, Notice, pressedStyle, Row, Screen, Section } from '@/components/form';
import { SelectionCircle } from '@/components/selection-circle';
import { ThemedText } from '@/components/themed-text';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { useStringParam } from '@/hooks/use-string-param';
import { useTheme } from '@/hooks/use-theme';
import {
  type Adventure,
  type AdventureId,
  barry,
  type EmergencyContact,
  type EmergencyContactId,
  type Point,
  reachableAddresses,
  type StartConditions,
  type StartWarning,
  startWarnings,
} from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { formatPhoneNumber } from '@/lib/phone';
import { refusalText, type Texts, useTexts } from '@/lib/texts';

type Form = {
  destination: string;
  destinationPoint: Point | null;
  route: string;
  deadline: Date;
  contactIds: EmergencyContactId[];
};

const inFourHours = () => {
  const at = new Date(Date.now() + 4 * 3600_000);
  at.setMinutes(Math.ceil(at.getMinutes() / 15) * 15, 0, 0);
  return at;
};

// A Planned Adventure's Deadline that has passed cannot start, and the picker would clamp it to now
// while the form still held the old date, so the sheet proposes a fresh one instead.
const toForm = (a: Adventure | null): Form => ({
  destination: a?.plan.destination ?? '',
  destinationPoint: a?.plan.destinationPoint ?? null,
  route: a?.plan.route ?? '',
  deadline: a?.deadline && a.deadline.getTime() > Date.now() ? a.deadline : inFourHours(),
  contactIds: a?.contacts.map((c) => c.id) ?? [],
});

// A place on the map is close enough to tap the pin onto it; the middle of Switzerland is not.
const PLACE_ZOOM = 14;
const SWITZERLAND: MapCamera = { center: { latitude: 46.8, longitude: 8.23 }, zoom: 7 };

const samePoint = (a: Point | null, b: Point | null) => a?.latitude === b?.latitude && a?.longitude === b?.longitude;

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const sorted = (ids: EmergencyContactId[]) => [...ids].sort().join(',');

const same = (a: Form, b: Form) =>
  a.destination === b.destination &&
  samePoint(a.destinationPoint, b.destinationPoint) &&
  a.route === b.route &&
  a.deadline.getTime() === b.deadline.getTime() &&
  sorted(a.contactIds) === sorted(b.contactIds);

const names = (contacts: EmergencyContact[]) => contacts.map((c) => c.name).join(', ');

const warningText = (w: StartWarning, t: Texts) => {
  switch (w.kind) {
    case 'no_trail':
      return t.plan.noTrail;
    case 'no_notifications':
      return t.plan.noNotifications;
    case 'email_only':
      return t.plan.emailOnly(names(w.contacts));
    case 'unreachable':
      return w.contacts.length === 1 ? t.plan.unreachableOne(names(w.contacts)) : t.plan.unreachableMany(names(w.contacts));
  }
};

const addresses = (contact: EmergencyContact) => {
  const { email, phone } = reachableAddresses(contact);
  return [email, phone && formatPhoneNumber(phone)].filter(Boolean).join(' · ');
};

export default function PlanScreen() {
  const [id, setId] = useState(useStringParam<AdventureId>('id'));
  const loaded = useLoad(async () => {
    const [contacts, adventure, conditions] = await Promise.all([
      barry.listContacts(),
      id ? barry.getAdventure(id) : null,
      barry.startConditions(),
    ]);
    return { contacts, adventure, conditions };
  });
  const t = useTexts();

  if (!loaded.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
        </Stack.Toolbar>
        <FirstLoad failure={loaded.error && t.plan.couldNotLoad} onRetry={loaded.reload} />
      </Screen>
    );
  }
  return <PlanForm data={loaded.data} id={id} setId={setId} reload={loaded.reload} />;
}

function PlanForm({
  data,
  id,
  setId,
  reload,
}: {
  data: { contacts: EmergencyContact[]; adventure: Adventure | null; conditions: StartConditions };
  id: AdventureId | undefined;
  setId: (id: AdventureId) => void;
  reload: () => void;
}) {
  const [initial, setInitial] = useState<Form>(() => toForm(data.adventure));
  const [form, setForm] = useState<Form>(initial);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'start' | 'find' | null>(null);
  const [camera, setCamera] = useState<MapCamera | null>(() =>
    initial.destinationPoint && { center: initial.destinationPoint, zoom: PLACE_ZOOM },
  );
  const theme = useTheme();
  const t = useTexts();
  const leave = useDiscardGuard(!same(form, initial));

  const adventure = data.adventure;
  const warnings = startWarnings(
    data.contacts.filter((c) => form.contactIds.includes(c.id)),
    data.conditions,
  );
  const live = adventure !== null && adventure.stage !== 'planned';
  const set = (field: 'destination' | 'route') => (text: string) =>
    setForm((f) => ({ ...f, [field]: text }));
  const pin = (point: Point | null) => setForm((f) => ({ ...f, destinationPoint: point }));

  // Apple Maps suggests where the destination is. Without a match, the map opens where the
  // Adventurer is, and they tap the place themselves.
  const showOnMap = async () => {
    setBusy('find');
    const found = await barry.findPlace(form.destination);
    const here = found ? null : await barry.currentPosition();
    setBusy(null);
    if (found) pin(found);
    const center = found ?? here;
    setCamera(center ? { center, zoom: PLACE_ZOOM } : SWITZERLAND);
  };

  const removeFromMap = () => {
    pin(null);
    setCamera(null);
  };

  const toggle = (contactId: EmergencyContactId) =>
    setForm((f) => ({
      ...f,
      contactIds: f.contactIds.includes(contactId)
        ? f.contactIds.filter((c) => c !== contactId)
        : [...f.contactIds, contactId],
    }));

  const save = async (): Promise<AdventureId | null> => {
    const result = await barry.saveAdventure({
      id,
      plan: {
        destination: orNull(form.destination) ?? undefined,
        destinationPoint: form.destinationPoint,
        route: orNull(form.route),
      },
      deadline: form.deadline,
      contactIds: form.contactIds,
    });
    if (result.kind === 'refused') {
      setNotice({ tone: 'danger', text: refusalText(result.refusal) });
      return null;
    }
    setId(result.adventure.id);
    setInitial(form);
    return result.adventure.id;
  };

  const onSave = async () => {
    setBusy('save');
    setNotice(null);
    const saved = await save().catch(() => {
      setNotice({ tone: 'danger', text: t.plan.couldNotSave });
      return null;
    });
    setBusy(null);
    if (saved) leave();
  };

  const allowTrail = async () => {
    const granted = await barry.trail.requestPermission().catch(() => false);
    if (!granted) await Linking.openSettings().catch(() => undefined);
    reload();
  };

  const onStart = async () => {
    setBusy('start');
    setNotice(null);
    const result = await save()
      .then((saved) => saved && barry.start(saved))
      .catch(() => 'failed' as const);
    setBusy(null);
    if (result === 'failed') setNotice({ tone: 'danger', text: t.plan.couldNotStart });
    else if (result?.kind === 'protected') leave();
    else if (result?.kind === 'refused') setNotice({ tone: 'danger', text: refusalText(result.refusal) });
    else if (result) {
      setNotice({
        tone: 'warning',
        text: t.plan.notProtected,
      });
    }
  };

  const onDelete = async () => {
    if (!id) return;
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') leave();
    else if (outcome.kind === 'failed') setNotice({ tone: 'danger', text: outcome.message });
  };

  const pickAndroid = () =>
    DateTimePickerAndroid.open({
      value: form.deadline,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (picked, time) => picked.type === 'set' && time && setForm((f) => ({ ...f, deadline: time })),
        });
      },
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: live ? t.plan.titleEdit : id ? t.plan.titlePlanned : t.plan.titleNew }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} disabled={busy !== null} onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {live ? (
          <Stack.Toolbar.Button
            variant="done"
            icon="checkmark"
            accessibilityLabel={t.common.save}
            disabled={busy !== null}
            onPress={onSave}
          />
        ) : (
          <Stack.Toolbar.Button variant="prominent" disabled={busy !== null} onPress={onStart}>
            {t.plan.start}
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      {/* A refusal or a failed Start must be seen; below the contacts it could sit off screen. */}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <Section title={t.plan.where}>
        <Field label={t.plan.destination} value={form.destination} onChangeText={set('destination')} />
        {Platform.OS === 'ios' &&
          (camera ? (
            <>
              <DestinationMap point={form.destinationPoint} camera={camera} onPick={pin} />
              <ThemedText type="small" themeColor="textSecondary">
                {form.destinationPoint ? t.plan.pinHint : t.plan.tapToPin}
              </ThemedText>
              <Button title={t.plan.removeFromMap} kind="secondary" disabled={busy !== null} onPress={removeFromMap} />
            </>
          ) : (
            <Button title={t.plan.showOnMap} kind="secondary" busy={busy === 'find'} disabled={busy !== null} onPress={showOnMap} />
          ))}
        <Field label={t.plan.route} value={form.route} onChangeText={set('route')} />
      </Section>

      {!live && (
        <Section title={t.plan.deadline}>
          <ThemedText type="small" themeColor="textSecondary">
            {t.plan.deadlineHint}
          </ThemedText>
          {Platform.OS === 'ios' ? (
            <View style={styles.picker}>
              <DateTimePicker
                value={form.deadline}
                mode="datetime"
                display="compact"
                minimumDate={new Date()}
                accentColor={theme.accent}
                onChange={(_, date) => date && setForm((f) => ({ ...f, deadline: date }))}
                accessibilityLabel={t.plan.deadline}
              />
            </View>
          ) : (
            <Button title={t.when(form.deadline)} kind="secondary" onPress={pickAndroid} />
          )}
        </Section>
      )}

      <Section title={t.plan.contacts}>
        {data.contacts.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {t.plan.noContacts}
          </ThemedText>
        )}
        {data.contacts.map((c, i) => {
          const chosen = form.contactIds.includes(c.id);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={c.name}
              onPress={() => toggle(c.id)}
              style={(state) => [styles.contact, pressedStyle(state)]}>
              <SelectionCircle selected={chosen} />
              <View
                style={[
                  styles.contactText,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                ]}>
                <ThemedText>{c.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {addresses(c)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </Section>

      {!live && (
        <>
          {warnings.map((w) => (
            <Notice key={w.kind} tone="warning">
              {warningText(w, t)}
            </Notice>
          ))}
          {warnings.some((w) => w.kind === 'no_trail') && (
            <Button title={t.plan.allowAlways} kind="secondary" onPress={allowTrail} />
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {t.plan.startHint(t.when(form.deadline))}
          </ThemedText>
          <Row>
            <Button title={t.plan.saveForLater} kind="secondary" onPress={onSave} busy={busy === 'save'} />
            {id && <Button title={t.common.delete} kind="danger" onPress={onDelete} />}
          </Row>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: { alignItems: 'flex-start' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactText: { flex: 1, paddingVertical: 10, gap: 2 },
});
