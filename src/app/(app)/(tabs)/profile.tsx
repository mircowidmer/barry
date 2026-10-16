import { useState } from 'react';

import { Button, Choice, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type AdventurerProfile, barry, type MessageLanguage } from '@/lib/barry';
import { askToDeleteAccount } from '@/lib/delete-account';
import { useSession } from '@/lib/session';
import { askToLogOut } from '@/lib/log-out';

type TextField = Exclude<keyof AdventurerProfile, 'messageLanguage'>;
type Form = Record<TextField, string> & { messageLanguage: MessageLanguage };

const empty: Form = { name: '', phone: '', carMake: '', carColour: '', carPlate: '', medicalNotes: '', messageLanguage: 'en' };

const languages: { value: MessageLanguage; title: string }[] = [
  { value: 'en', title: 'English' },
  { value: 'de', title: 'Deutsch' },
];

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

const toForm = (p: AdventurerProfile): Form => ({
  name: p.name,
  phone: p.phone,
  carMake: p.carMake ?? '',
  carColour: p.carColour ?? '',
  carPlate: p.carPlate ?? '',
  medicalNotes: p.medicalNotes ?? '',
  messageLanguage: p.messageLanguage,
});

export default function ProfileScreen() {
  const loaded = useLoad(() => barry.getProfile());
  if (loaded.status === 'loading') return <Screen title="Profile">{null}</Screen>;
  return <ProfileForm initial={loaded.data ? toForm(loaded.data) : empty} />;
}

function ProfileForm({ initial }: { initial: Form }) {
  const { session } = useSession();
  const [profile, setProfile] = useState<Form>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleteError(null);
    const outcome = await askToDeleteAccount(() => setDeleting(true));
    setDeleting(false);
    if (outcome.kind === 'failed') setDeleteError(outcome.message);
  };

  const set = (field: TextField) => (text: string) => {
    setProfile((p) => ({ ...p, [field]: text }));
    setStatus('idle');
  };

  const setLanguage = (messageLanguage: MessageLanguage) => {
    setProfile((p) => ({ ...p, messageLanguage }));
    setStatus('idle');
  };

  const save = async () => {
    setStatus('saving');
    try {
      await barry.saveProfile({
        name: profile.name.trim(),
        phone: profile.phone.replace(/\s/g, ''),
        carMake: orNull(profile.carMake),
        carColour: orNull(profile.carColour),
        carPlate: orNull(profile.carPlate),
        medicalNotes: orNull(profile.medicalNotes),
        messageLanguage: profile.messageLanguage,
      });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Screen title="Profile">
      <ThemedText themeColor="textSecondary">
        An Alert gives your emergency contacts this information, so rescuers know who and what to look for.
      </ThemedText>
      <Section title="About You">
        <Field label="Name" value={profile.name} onChangeText={set('name')} autoComplete="name" />
        <Field label="Email Address" value={session?.user.email ?? ''} editable={false} hint="You sign in with this address." />
        <Field
          label="Phone Number"
          value={profile.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          hint="With country code, for example +41771234567."
        />
      </Section>
      <Section title="Car (optional)">
        <Field label="Make" value={profile.carMake} onChangeText={set('carMake')} />
        <Field label="Colour" value={profile.carColour} onChangeText={set('carColour')} />
        <Field label="Number Plate" value={profile.carPlate} onChangeText={set('carPlate')} autoCapitalize="characters" />
      </Section>
      <Section title="Medical Notes (optional)">
        <Field
          label="Medical Notes"
          value={profile.medicalNotes}
          onChangeText={set('medicalNotes')}
          multiline
          hint="Only sent in an alert, never in a heads-up."
        />
      </Section>
      <Section title="Messages to Your Contacts">
        <Choice
          label="Language"
          options={languages}
          value={profile.messageLanguage}
          onChange={setLanguage}
          hint="Barry writes the Heads-up, Plan Update, Alert and All-clear in this language."
        />
      </Section>
      {status === 'saved' && <Notice tone="success">Profile saved.</Notice>}
      {status === 'error' && (
        <Notice tone="danger">Could not save. Check that the phone number starts with + and the country code.</Notice>
      )}
      {deleteError && <Notice tone="danger">{deleteError}</Notice>}
      <Row>
        <Button
          title="Save"
          onPress={save}
          busy={status === 'saving'}
          disabled={profile.name.trim() === '' || profile.phone.trim() === ''}
        />
        <Button title="Log Out" kind="secondary" onPress={askToLogOut} />
        <Button title="Delete" kind="danger" onPress={deleteAccount} busy={deleting} />
      </Row>
    </Screen>
  );
}
