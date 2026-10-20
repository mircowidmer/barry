import { router, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { FirstLoad, LoadState, Screen } from '@/components/form';
import { ActionRow, Group, InputRow, TextAreaRow } from '@/components/grouped-list';
import { SITE } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type AdventurerProfile, barry, isPhoneNumber } from '@/lib/barry';
import { askToDeleteAccount } from '@/lib/delete-account';
import { askToLogOut } from '@/lib/log-out';
import { formatPhoneNumber, phoneInput } from '@/lib/phone';
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
  const failure = (e: Error) => t.common.couldNotReach(e.message);
  // One scroll view from the first load on, because iOS ties the large title to the first one it sees.
  // A failed first load must not show a blank Profile, or saving it would wipe the stored one.
  return (
    <Screen onRefresh={loaded.data === undefined ? undefined : loaded.reload}>
      {loaded.data === undefined ? (
        <FirstLoad failure={loaded.error && failure(loaded.error)} onRetry={loaded.reload} />
      ) : (
        <ProfileForm stored={loaded.data} reloadFailure={<LoadState loaded={loaded} failure={failure} />} />
      )}
    </Screen>
  );
}

const formOf = (stored: AdventurerProfile | null) => (stored ? toForm(stored) : empty);

function ProfileForm({ stored, reloadFailure }: { stored: AdventurerProfile | null; reloadFailure: ReactNode }) {
  const t = useTexts();
  const [seen, setSeen] = useState(stored);
  const [saved, setSaved] = useState<Form>(() => formOf(stored));
  const [profile, setProfile] = useState<Form>(saved);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A reload takes the stored Profile only while the form holds no unsaved edits.
  if (seen !== stored) {
    setSeen(stored);
    if (same(profile, saved)) {
      setSaved(formOf(stored));
      setProfile(formOf(stored));
    }
  }

  const set = (field: keyof Form) => (text: string) => setProfile((p) => ({ ...p, [field]: text }));
  const complete = profile.name.trim() !== '' && isPhoneNumber(profile.phone);

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
      Alert.alert(t.common.couldNotSave, t.profile.couldNotSave);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    const outcome = await askToDeleteAccount(() => setDeleting(true));
    setDeleting(false);
    if (outcome.kind === 'failed') Alert.alert(t.common.couldNotDelete, outcome.message);
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
      {reloadFailure}
      <ThemedText type="small" themeColor="textSecondary">
        {t.profile.intro}
      </ThemedText>

      <Group title={t.profile.about}>
        <InputRow
          label={t.profile.name}
          value={profile.name}
          onChangeText={set('name')}
          placeholder={t.profile.required}
          autoComplete="name"
          textContentType="name"
        />
        <InputRow
          label={t.profile.phone}
          value={profile.phone}
          onChangeText={(text) => set('phone')(phoneInput(text))}
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

      <Group title={t.profile.medical}>
        <TextAreaRow
          label={t.profile.medicalLabel}
          value={profile.medicalNotes}
          onChangeText={set('medicalNotes')}
          placeholder={t.profile.medicalPlaceholder}
        />
      </Group>

      <Group title={t.profile.accountSection}>
        <ActionRow title={t.profile.account} tone="text" onPress={() => router.push('/profile/account')} />
        <ActionRow title={t.profile.logOut} onPress={askToLogOut} />
      </Group>

      <Group>
        <ActionRow title={t.profile.deleteAccount} tone="danger" onPress={deleteAccount} busy={deleting} />
      </Group>

      <Group footer={t.legal.notEmergency}>
        <ActionRow title={t.legal.privacy} tone="text" chevron onPress={() => Linking.openURL(`${SITE}/privacy`)} />
        <ActionRow title={t.legal.terms} tone="text" chevron onPress={() => Linking.openURL(`${SITE}/terms`)} />
      </Group>
    </>
  );
}
