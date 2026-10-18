import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Button, Loading, Notice, Screen } from '@/components/form';
import { ActionRow, Group, InputRow, TextAreaRow, ValueRow } from '@/components/grouped-list';
import { SITE } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type AdventurerProfile, barry } from '@/lib/barry';
import { askToDeleteAccount } from '@/lib/delete-account';
import { askToLogOut } from '@/lib/log-out';
import { formatPhoneNumber, phoneInput } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useTexts } from '@/lib/texts';

type Form = Record<keyof AdventurerProfile, string>;

const empty: Form = { name: '', phone: '', carMake: '', carColour: '', carPlate: '', medicalNotes: '' };

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const toForm = (p: AdventurerProfile): Form => ({
  name: p.name,
  phone: formatPhoneNumber(p.phone),
  carMake: p.carMake ?? '',
  carColour: p.carColour ?? '',
  carPlate: p.carPlate ?? '',
  medicalNotes: p.medicalNotes ?? '',
});

const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((key) => a[key] === b[key]);

export default function ProfileScreen() {
  const loaded = useLoad(() => barry.getProfile());
  const t = useTexts();
  // The form keeps the first Profile that loads, so edits survive the reloads on focus.
  const [initial, setInitial] = useState<Form | null>(null);
  if (initial === null && loaded.status === 'ready') setInitial(loaded.data ? toForm(loaded.data) : empty);
  if (initial) return <ProfileForm initial={initial} />;
  // A failed load must not show a blank Profile, or saving it would wipe the stored one.
  if (loaded.status === 'error') {
    return (
      <Screen>
        <Notice tone="danger">{t.common.couldNotReach(loaded.error.message)}</Notice>
        <Button title={t.common.tryAgain} onPress={loaded.reload} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Loading />
    </Screen>
  );
}

function ProfileForm({ initial }: { initial: Form }) {
  const { session } = useSession();
  const t = useTexts();
  const [saved, setSaved] = useState<Form>(initial);
  const [profile, setProfile] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (field: keyof Form) => (text: string) => setProfile((p) => ({ ...p, [field]: text }));
  const complete = profile.name.trim() !== '' && profile.phone.trim() !== '';

  const save = async () => {
    setSaving(true);
    try {
      await barry.saveProfile({
        name: profile.name.trim(),
        phone: profile.phone.replace(/\s/g, ''),
        carMake: orNull(profile.carMake),
        carColour: orNull(profile.carColour),
        carPlate: orNull(profile.carPlate),
        medicalNotes: orNull(profile.medicalNotes),
      });
      setSaved(profile);
    } catch {
      Alert.alert(t.profile.couldNotSave);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    const outcome = await askToDeleteAccount(() => setDeleting(true));
    setDeleting(false);
    if (outcome.kind === 'failed') Alert.alert(outcome.message);
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="done"
          icon="checkmark"
          accessibilityLabel={t.common.save}
          disabled={!complete || saving || same(profile, saved)}
          onPress={save}
        />
      </Stack.Toolbar>
      <Screen>
        <ThemedText type="small" themeColor="textSecondary">
          {t.profile.intro}
        </ThemedText>

        <Group title={t.profile.about} footer={t.profile.phoneHint}>
          <InputRow
            label={t.profile.name}
            value={profile.name}
            onChangeText={set('name')}
            placeholder={t.profile.required}
            autoComplete="name"
            textContentType="name"
          />
          <ValueRow label={t.profile.email} value={session?.user.email ?? ''} />
          <InputRow
            label={t.profile.phone}
            value={profile.phone}
            onChangeText={(text) => set('phone')(phoneInput(text))}
            placeholder={t.profile.required}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </Group>

        <Group title={t.profile.car}>
          <InputRow label={t.profile.make} value={profile.carMake} onChangeText={set('carMake')} placeholder={t.profile.optional} />
          <InputRow label={t.profile.colour} value={profile.carColour} onChangeText={set('carColour')} placeholder={t.profile.optional} />
          <InputRow
            label={t.profile.plate}
            value={profile.carPlate}
            onChangeText={set('carPlate')}
            placeholder={t.profile.optional}
            autoCapitalize="characters"
          />
        </Group>

        <Group title={t.profile.medical} footer={t.profile.medicalHint}>
          <TextAreaRow
            label={t.profile.medicalLabel}
            value={profile.medicalNotes}
            onChangeText={set('medicalNotes')}
            placeholder={t.profile.medicalPlaceholder}
          />
        </Group>

        <Group footer={t.legal.notEmergency}>
          <ActionRow title={t.legal.privacy} tone="text" chevron onPress={() => Linking.openURL(`${SITE}/privacy`)} />
          <ActionRow title={t.legal.terms} tone="text" chevron onPress={() => Linking.openURL(`${SITE}/terms`)} />
        </Group>

        <Group>
          <ActionRow title={t.profile.logOut} onPress={askToLogOut} />
        </Group>

        <Group>
          <ActionRow title={t.profile.deleteAccount} tone="danger" onPress={deleteAccount} busy={deleting} />
        </Group>
      </Screen>
    </>
  );
}
