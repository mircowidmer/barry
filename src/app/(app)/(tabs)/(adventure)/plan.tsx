import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Keyboard, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { DestinationPreview, type MapCamera } from '@/components/destination-map';
import { Button, Field, FirstLoad, pressedStyle, Row, Screen, Section } from '@/components/form';
import { Note } from '@/components/grouped-list';
import { PinPicker } from '@/components/pin-picker';
import { SelectionCircle } from '@/components/selection-circle';
import { ThemedText } from '@/components/themed-text';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { usePlaceSuggestions } from '@/hooks/use-place-suggestions';
import { useStringParam } from '@/hooks/use-string-param';
import { useTheme } from '@/hooks/use-theme';
import {
  type Adventure,
  type AdventureId,
  barry,
  type EmergencyContact,
  type EmergencyContactId,
  type Place,
  type Point,
  reachableAddresses,
  type StartConditions,
  type StartWarning,
  startWarnings,
} from '@/lib/barry';
import { LIMITS } from '@/lib/barry/limits';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { formatPhoneNumber } from '@/lib/phone';
import { refusalText, type Texts, useTexts } from '@/lib/texts';

type Form = {
  destination: string;
  destinationPoint: Point | null;
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
        <FirstLoad failure={loaded.error && t.plan.couldNotLoad} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }
  return <PlanForm data={loaded.data} id={id} setId={setId} reload={() => void loaded.reload()} />;
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
  const [busy, setBusy] = useState<'save' | 'start' | 'find' | null>(null);
  // The map the pin picker opens on; null while it is closed.
  const [picking, setPicking] = useState<MapCamera | null>(null);
  // Suggestions follow what the Adventurer types and go away once they pick or keep it.
  const [suggesting, setSuggesting] = useState(false);
  const places = usePlaceSuggestions(suggesting ? form.destination : null);
  const theme = useTheme();
  const t = useTexts();
  const leave = useDiscardGuard(!same(form, initial));

  const adventure = data.adventure;
  const warnings = startWarnings(
    data.contacts.filter((c) => form.contactIds.includes(c.id)),
    data.conditions,
  );
  const live = adventure !== null && adventure.stage !== 'planned';
  // Each Start warning sits in the group it is about; a live Adventure has started, so it shows none.
  const shown = live ? [] : warnings;
  const noTrail = shown.some((w) => w.kind === 'no_trail');
  const noNotifications = shown.some((w) => w.kind === 'no_notifications');
  const contactWarnings = shown.filter((w) => w.kind === 'email_only' || w.kind === 'unreachable');
  const typeDestination = (destination: string) => {
    setForm((f) => ({ ...f, destination }));
    setSuggesting(true);
  };
  const pin = (point: Point | null) => setForm((f) => ({ ...f, destinationPoint: point }));

  const choose = (place: Place) => {
    // The typed field stops at the limit; a place's name must too, or the save is refused.
    setForm((f) => ({ ...f, destination: place.name.slice(0, LIMITS.destinationLength), destinationPoint: place.point }));
    setSuggesting(false);
    Keyboard.dismiss();
  };

  const keepTyped = () => {
    setSuggesting(false);
    Keyboard.dismiss();
  };

  // The picker opens on the pin, else on the place Apple Maps finds for the destination, else where
  // the Adventurer is.
  const openPicker = async () => {
    if (form.destinationPoint) {
      setPicking({ center: form.destinationPoint, zoom: PLACE_ZOOM });
      return;
    }
    setBusy('find');
    const [found] = await barry.findPlaces(form.destination);
    const center = found?.point ?? (await barry.currentPosition());
    setBusy(null);
    setPicking(center ? { center, zoom: PLACE_ZOOM } : SWITZERLAND);
  };

  const arrive = (on: boolean) => (on ? void openPicker() : pin(null));

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
      },
      deadline: form.deadline,
      contactIds: form.contactIds,
    });
    if (result.kind === 'refused') {
      Alert.alert(t.common.couldNotSave, refusalText(result.refusal));
      return null;
    }
    setId(result.adventure.id);
    setInitial(form);
    return result.adventure.id;
  };

  const onSave = async () => {
    setBusy('save');
    const saved = await save().catch(() => {
      Alert.alert(t.common.couldNotSave, t.plan.couldNotSave);
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
    const result = await save()
      .then((saved) => saved && barry.start(saved))
      .catch(() => 'failed' as const);
    setBusy(null);
    if (result === 'failed') Alert.alert(t.plan.couldNotStartTitle, t.plan.couldNotStart);
    else if (result?.kind === 'protected') leave();
    else if (result?.kind === 'refused') Alert.alert(t.plan.couldNotStartTitle, refusalText(result.refusal));
    else if (result) {
      Alert.alert(t.plan.notProtectedTitle, t.plan.notProtected, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.tryAgain, onPress: () => void onStart() },
      ]);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') leave();
    else if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
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
            onPress={() => void onSave()}
          />
        ) : (
          <Stack.Toolbar.Button variant="prominent" disabled={busy !== null} onPress={() => void onStart()}>
            {t.plan.start}
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      <Section title={t.plan.where}>
        <Field label={t.plan.destination} value={form.destination} onChangeText={typeDestination} maxLength={LIMITS.destinationLength} />
        {places.length > 0 && (
          <View>
            {places.map((place, i) => (
              <Pressable
                key={`${place.point.latitude},${place.point.longitude}`}
                accessibilityRole="button"
                accessibilityLabel={place.subtitle ? `${place.name}, ${place.subtitle}` : place.name}
                onPress={() => choose(place)}
                style={(state) => [styles.place, pressedStyle(state)]}>
                <SymbolView name="mappin.circle.fill" size={30} tintColor={theme.accent} fallback={null} />
                <View style={[styles.placeText, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                  <ThemedText numberOfLines={1}>{place.name}</ThemedText>
                  {place.subtitle !== '' && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {place.subtitle}
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={keepTyped} style={(state) => [styles.place, pressedStyle(state)]}>
              <SymbolView name="minus.circle" size={30} tintColor={theme.textSecondary} fallback={null} />
              <View style={[styles.placeText, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                <ThemedText numberOfLines={1}>{t.plan.keepWithoutPin(form.destination.trim())}</ThemedText>
              </View>
            </Pressable>
          </View>
        )}
        {Platform.OS === 'ios' && (
          <>
            <View style={styles.arrive}>
              <ThemedText style={styles.arriveLabel}>{t.plan.arrive}</ThemedText>
              <Switch
                accessibilityLabel={t.plan.arrive}
                value={form.destinationPoint !== null || busy === 'find'}
                onValueChange={arrive}
                disabled={busy !== null}
                trackColor={{ true: theme.success }}
              />
            </View>
            {form.destinationPoint && (
              <DestinationPreview point={form.destinationPoint} adjust={t.plan.adjust} onAdjust={() => void openPicker()} />
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {form.destinationPoint ? t.plan.arriveOn : t.plan.arriveOff}
            </ThemedText>
          </>
        )}
        {noTrail && (
          <>
            <Note tone="warning" icon="location.slash">
              {t.plan.noTrail}
            </Note>
            <Button title={t.plan.allowAlways} kind="secondary" onPress={() => void allowTrail()} />
          </>
        )}
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
          {noNotifications && (
            <Note tone="warning" icon="bell.slash">
              {t.plan.noNotifications}
            </Note>
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
        {contactWarnings.map((w) => (
          <Note key={w.kind} tone="warning">
            {warningText(w, t)}
          </Note>
        ))}
      </Section>

      {!live && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t.plan.startHint(t.when(form.deadline))}
          </ThemedText>
          <Row>
            <Button title={t.plan.saveForLater} kind="secondary" onPress={() => void onSave()} busy={busy === 'save'} />
            {id && <Button title={t.common.delete} kind="danger" onPress={() => void onDelete()} />}
          </Row>
        </>
      )}
      <PinPicker
        start={picking}
        onCancel={() => setPicking(null)}
        onPick={(point) => {
          pin(point);
          setPicking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: { alignItems: 'flex-start' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeText: { flex: 1, minHeight: 52, justifyContent: 'center', paddingVertical: 8, gap: 2 },
  arrive: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  arriveLabel: { flex: 1 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactText: { flex: 1, paddingVertical: 10, gap: 2 },
});
