import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import {
  type Adventure,
  type AdventureId,
  barry,
  type EmergencyContact,
  type EmergencyContactId,
  type StartConditions,
  type StartWarning,
  startWarnings,
} from '@/lib/barry';
import { askToDeleteAdventure } from '@/lib/delete-adventure';
import { formatWhen, refusalText } from '@/lib/wording';

type Form = {
  destination: string;
  route: string;
  startingPoint: string;
  notes: string;
  deadline: Date;
  contactIds: EmergencyContactId[];
};

const inFourHours = () => {
  const at = new Date(Date.now() + 4 * 3600_000);
  at.setMinutes(Math.ceil(at.getMinutes() / 15) * 15, 0, 0);
  return at;
};

const toForm = (a: Adventure | null): Form => ({
  destination: a?.plan.destination ?? '',
  route: a?.plan.route ?? '',
  startingPoint: a?.plan.startingPoint ?? '',
  notes: a?.plan.notes ?? '',
  deadline: a?.deadline ?? inFourHours(),
  contactIds: a?.contacts.map((c) => c.id) ?? [],
});

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const names = (contacts: EmergencyContact[]) => contacts.map((c) => c.name).join(', ');

const warningTexts: { [K in StartWarning['kind']]: (w: Extract<StartWarning, { kind: K }>) => string } = {
  no_trail: () => 'Barry can share only where you started. Allow location Always to share your Trail.',
  no_notifications: () => 'Notifications are off for Barry, so you will get no Reminder or Overdue Notice.',
  email_only: (w) => `Text messages are not set up yet, so ${names(w.contacts)} get email only.`,
  unreachable: (w) =>
    w.contacts.length === 1
      ? `Text messages are not set up yet, and ${w.contacts[0].name} only has a phone number, so they will get no message at all.`
      : `Text messages are not set up yet, and ${names(w.contacts)} only have a phone number, so they will get no message at all.`,
};

const warningText = (w: StartWarning) => (warningTexts[w.kind] as (w: StartWarning) => string)(w);

export default function PlanScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [id, setId] = useState<AdventureId | undefined>(params.id as AdventureId | undefined);
  const loaded = useLoad(async () => {
    const [contacts, adventure, conditions] = await Promise.all([
      barry.listContacts(),
      id ? barry.getAdventure(id) : null,
      barry.startConditions(),
    ]);
    return { contacts, adventure, conditions };
  });

  if (!loaded.data) {
    return (
      <Screen>{loaded.status === 'error' && <Notice tone="danger">Could not load the Adventure.</Notice>}</Screen>
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
  const [form, setForm] = useState<Form>(() => toForm(data.adventure));
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'start' | null>(null);
  const theme = useTheme();

  const adventure = data.adventure;
  const warnings = startWarnings(
    data.contacts.filter((c) => form.contactIds.includes(c.id)),
    data.conditions,
  );
  const live = adventure !== null && adventure.stage !== 'planned';
  const set = (field: 'destination' | 'route' | 'startingPoint' | 'notes') => (text: string) =>
    setForm((f) => ({ ...f, [field]: text }));
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
        route: orNull(form.route),
        startingPoint: orNull(form.startingPoint),
        notes: orNull(form.notes),
      },
      deadline: form.deadline,
      contactIds: form.contactIds,
    });
    if (result.kind === 'refused') {
      setNotice({ tone: 'danger', text: refusalText(result.refusal) });
      return null;
    }
    setId(result.adventure.id);
    return result.adventure.id;
  };

  const onSave = async () => {
    setBusy('save');
    setNotice(null);
    const saved = await save().catch(() => {
      setNotice({ tone: 'danger', text: 'Could not save the Adventure. Try again.' });
      return null;
    });
    setBusy(null);
    if (saved) {
      if (live) router.back();
      else {
        setNotice({ tone: 'success', text: 'Saved. Start it when you head out.' });
        reload();
      }
    }
  };

  const allowTrail = async () => {
    const granted = await barry.trail.requestPermission().catch(() => false);
    if (!granted) await Linking.openSettings();
    reload();
  };

  const onStart = async () => {
    setBusy('start');
    setNotice(null);
    const result = await save()
      .then((saved) => saved && barry.start(saved))
      .catch(() => 'failed' as const);
    setBusy(null);
    if (result === 'failed') setNotice({ tone: 'danger', text: 'Could not start the Adventure. Try again.' });
    else if (result?.kind === 'protected') router.back();
    else if (result?.kind === 'refused') setNotice({ tone: 'danger', text: refusalText(result.refusal) });
    else if (result) {
      setNotice({
        tone: 'warning',
        text: 'You are not protected yet. Barry did not confirm the Start. Try again when you have signal.',
      });
    }
  };

  const onDelete = async () => {
    if (!id) return;
    const outcome = await askToDeleteAdventure(id, 'planned');
    if (outcome.kind === 'deleted') router.back();
    else if (outcome.kind === 'failed') setNotice({ tone: 'danger', text: outcome.message });
  };

  const pickAndroid = () =>
    DateTimePickerAndroid.open({
      value: form.deadline,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (_, date) => {
        if (!date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (__, time) => time && setForm((f) => ({ ...f, deadline: time })),
        });
      },
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: live ? 'Edit Adventure' : id ? 'Planned Adventure' : 'Plan an Adventure' }} />

      <Section title="Where are you going?">
        <Field label="Destination" value={form.destination} onChangeText={set('destination')} placeholder="Where are you going to?" />
        <Field label="Route" value={form.route} onChangeText={set('route')} placeholder="Optional" />
        <Field
          label="Starting Point"
          value={form.startingPoint}
          onChangeText={set('startingPoint')}
          placeholder="Optional, for example where you park"
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={set('notes')}
          multiline
          placeholder="Optional, for example what you are wearing"
        />
      </Section>

      {!live && (
        <Section title="Deadline">
          <ThemedText type="small" themeColor="textSecondary">
            If you have not checked in by then, Barry waits 1 minute and then alerts your contacts.
          </ThemedText>
          {Platform.OS === 'ios' ? (
            <View style={{ alignItems: 'flex-start' }}>
              <DateTimePicker
                value={form.deadline}
                mode="datetime"
                display="compact"
                minimumDate={new Date()}
                onChange={(_, date) => date && setForm((f) => ({ ...f, deadline: date }))}
                accessibilityLabel="Deadline"
              />
            </View>
          ) : (
            <Button title={formatWhen(form.deadline)} kind="secondary" onPress={pickAndroid} />
          )}
        </Section>
      )}

      <Section title="Emergency Contacts">
        {data.contacts.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            You have no contacts yet. Add them in the Contacts tab.
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
              style={({ pressed }) => [styles.contact, pressed && { opacity: 0.5 }]}>
              <SymbolView
                name={chosen ? 'checkmark.circle.fill' : 'circle'}
                tintColor={chosen ? theme.accent : theme.textSecondary}
                size={24}
                fallback={<ThemedText style={{ color: chosen ? theme.accent : theme.textSecondary }}>{chosen ? '●' : '○'}</ThemedText>}
              />
              <View
                style={[
                  styles.contactText,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                ]}>
                <ThemedText>{c.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[c.email, c.phone].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </Section>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {live ? (
        <Button title="Save" onPress={onSave} busy={busy === 'save'} />
      ) : (
        <>
          {warnings.map((w) => (
            <Notice key={w.kind} tone="warning">
              {warningText(w)}
            </Notice>
          ))}
          {warnings.some((w) => w.kind === 'no_trail') && (
            <Button title="Allow Always" kind="secondary" onPress={allowTrail} />
          )}
          <Button title="Start Adventure" onPress={onStart} busy={busy === 'start'} />
          <ThemedText type="small" themeColor="textSecondary">
            Starting sends a heads-up to your contacts with your plan and deadline, which is {formatWhen(form.deadline)}.
          </ThemedText>
          <Row>
            <Button title="Save for Later" kind="secondary" onPress={onSave} busy={busy === 'save'} />
            {id && <Button title="Delete" kind="danger" onPress={onDelete} />}
          </Row>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactText: { flex: 1, paddingVertical: 10, gap: 2 },
});
