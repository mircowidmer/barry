import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { SelectionCircle } from '@/components/selection-circle';
import { ThemedText } from '@/components/themed-text';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import {
  type Adventure,
  type AdventureId,
  barry,
  type EmergencyContact,
  type EmergencyContactId,
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
  route: string;
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
  deadline: a?.deadline ?? inFourHours(),
  contactIds: a?.contacts.map((c) => c.id) ?? [],
});

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const sorted = (ids: EmergencyContactId[]) => [...ids].sort().join(',');

const same = (a: Form, b: Form) =>
  a.destination === b.destination &&
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
      return w.contacts.length === 1 ? t.plan.unreachableOne(w.contacts[0].name) : t.plan.unreachableMany(names(w.contacts));
  }
};

const addresses = (contact: EmergencyContact) => {
  const { email, phone } = reachableAddresses(contact);
  return [email, phone && formatPhoneNumber(phone)].filter(Boolean).join(' · ');
};

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
  const t = useTexts();

  if (!loaded.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
        </Stack.Toolbar>
        {loaded.status === 'error' && (
          <>
            <Notice tone="danger">{t.plan.couldNotLoad}</Notice>
            <Button title={t.common.tryAgain} kind="secondary" onPress={loaded.reload} />
          </>
        )}
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
  const [busy, setBusy] = useState<'save' | 'start' | null>(null);
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

      <Section title={t.plan.where}>
        <Field label={t.plan.destination} value={form.destination} onChangeText={set('destination')} />
        <Field label={t.plan.route} value={form.route} onChangeText={set('route')} />
      </Section>

      {!live && (
        <Section title={t.plan.deadline}>
          <ThemedText type="small" themeColor="textSecondary">
            {t.plan.deadlineHint}
          </ThemedText>
          {Platform.OS === 'ios' ? (
            <View style={{ alignItems: 'flex-start' }}>
              <DateTimePicker
                value={form.deadline}
                mode="datetime"
                display="compact"
                minimumDate={new Date()}
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
              style={({ pressed }) => [styles.contact, pressed && { opacity: 0.5 }]}>
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

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
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
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactText: { flex: 1, paddingVertical: 10, gap: 2 },
});
