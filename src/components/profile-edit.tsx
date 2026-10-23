import { router, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert } from 'react-native';

import { FirstLoad, Screen } from '@/components/form';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useLoad } from '@/hooks/use-load';
import { type AdventurerProfile, barry, isPhoneNumber } from '@/lib/barry';
import { formatPhoneNumber } from '@/lib/phone';
import { useTexts } from '@/lib/texts';

export type ProfileForm = Record<keyof AdventurerProfile, string>;
export type SetField = (field: keyof ProfileForm) => (text: string) => void;

const empty: ProfileForm = { name: '', phone: '', carMake: '', carColour: '', carPlate: '', medicalNotes: '' };

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const toForm = (p: AdventurerProfile | null): ProfileForm =>
  p === null
    ? empty
    : {
        name: p.name,
        phone: p.phone === null ? '' : formatPhoneNumber(p.phone),
        carMake: p.carMake ?? '',
        carColour: p.carColour ?? '',
        carPlate: p.carPlate ?? '',
        medicalNotes: p.medicalNotes ?? '',
      };

const toProfile = (form: ProfileForm): AdventurerProfile => ({
  name: form.name.trim(),
  phone: orNull(form.phone.replace(/\s/g, '')),
  carMake: orNull(form.carMake),
  carColour: orNull(form.carColour),
  carPlate: orNull(form.carPlate),
  medicalNotes: orNull(form.medicalNotes),
});

const same = (a: ProfileForm, b: ProfileForm) => (Object.keys(a) as (keyof ProfileForm)[]).every((key) => a[key] === b[key]);

type Editor = { form: ProfileForm; set: SetField; save: (changes?: Partial<ProfileForm>) => void; saving: boolean };

/**
 * One edit screen of the Profile: it loads the stored Profile, shows the fields its children draw, and saves the
 * whole Profile with the checkmark, because the Profile is stored as one row. A sheet gets a close button; a pushed
 * screen keeps its back button. Either way, unsaved changes ask before they are dropped.
 */
export function ProfileEdit({ title, sheet = false, children }: { title: string; sheet?: boolean; children: (editor: Editor) => ReactNode }) {
  const loaded = useLoad(() => barry.getProfile());
  const t = useTexts();
  if (loaded.data !== undefined) {
    return (
      <ProfileEditor stored={loaded.data} title={title} sheet={sheet}>
        {children}
      </ProfileEditor>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {sheet && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} onPress={() => router.back()} />
        </Stack.Toolbar>
      )}
      <FirstLoad failure={loaded.error && t.common.couldNotReach} onRetry={() => void loaded.reload()} />
    </Screen>
  );
}

function ProfileEditor({
  stored,
  title,
  sheet,
  children,
}: {
  stored: AdventurerProfile | null;
  title: string;
  sheet: boolean;
  children: (editor: Editor) => ReactNode;
}) {
  const t = useTexts();
  const [initial] = useState(() => toForm(stored));
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const leave = useDiscardGuard(!same(form, initial));

  const set: SetField = (field) => (text) => setForm((f) => ({ ...f, [field]: text }));
  const complete = form.name.trim() !== '' && (form.phone.trim() === '' || isPhoneNumber(form.phone));

  const save = async (changes: Partial<ProfileForm> = {}) => {
    setSaving(true);
    try {
      await barry.saveProfile(toProfile({ ...form, ...changes }));
      leave();
    } catch {
      setSaving(false);
      Alert.alert(t.common.couldNotSave, t.profile.couldNotSave);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {sheet && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={t.common.cancel} disabled={saving} onPress={() => router.back()} />
        </Stack.Toolbar>
      )}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="done"
          icon="checkmark"
          accessibilityLabel={t.common.save}
          disabled={!complete || saving}
          onPress={() => void save()}
        />
      </Stack.Toolbar>
      {children({ form, set, save: (changes) => void save(changes), saving })}
    </Screen>
  );
}
