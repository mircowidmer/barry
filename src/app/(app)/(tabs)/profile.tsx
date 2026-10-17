import { useState } from 'react';

import { Button, Field, Notice, Row, Screen, Section } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useLoad } from '@/hooks/use-load';
import { type AdventurerProfile, barry } from '@/lib/barry';
import { askToDeleteAccount } from '@/lib/delete-account';
import { formatPhoneNumber, phoneInput } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { askToLogOut } from '@/lib/log-out';
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

export default function ProfileScreen() {
  const loaded = useLoad(() => barry.getProfile());
  const t = useTexts();
  if (loaded.status === 'loading') return <Screen title={t.profile.title}>{null}</Screen>;
  return <ProfileForm initial={loaded.data ? toForm(loaded.data) : empty} />;
}

function ProfileForm({ initial }: { initial: Form }) {
  const { session } = useSession();
  const t = useTexts();
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

  const set = (field: keyof Form) => (text: string) => {
    setProfile((p) => ({ ...p, [field]: text }));
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
      });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Screen title={t.profile.title}>
      <ThemedText themeColor="textSecondary">{t.profile.intro}</ThemedText>
      <Section title={t.profile.about}>
        <Field label={t.profile.name} value={profile.name} onChangeText={set('name')} autoComplete="name" />
        <Field label={t.profile.email} value={session?.user.email ?? ''} editable={false} hint={t.profile.emailHint} />
        <Field
          label={t.profile.phone}
          value={profile.phone}
          onChangeText={(text) => set('phone')(phoneInput(text))}
          keyboardType="phone-pad"
          autoComplete="tel"
          hint={t.profile.phoneHint}
        />
      </Section>
      <Section title={t.profile.car}>
        <Field label={t.profile.make} value={profile.carMake} onChangeText={set('carMake')} />
        <Field label={t.profile.colour} value={profile.carColour} onChangeText={set('carColour')} />
        <Field label={t.profile.plate} value={profile.carPlate} onChangeText={set('carPlate')} autoCapitalize="characters" />
      </Section>
      <Section title={t.profile.medical}>
        <Field
          label={t.profile.medicalLabel}
          value={profile.medicalNotes}
          onChangeText={set('medicalNotes')}
          multiline
          hint={t.profile.medicalHint}
        />
      </Section>
      {status === 'saved' && <Notice tone="success">{t.profile.saved}</Notice>}
      {status === 'error' && <Notice tone="danger">{t.profile.couldNotSave}</Notice>}
      {deleteError && <Notice tone="danger">{deleteError}</Notice>}
      <Row>
        <Button
          title={t.common.save}
          onPress={save}
          busy={status === 'saving'}
          disabled={profile.name.trim() === '' || profile.phone.trim() === ''}
        />
        <Button title={t.profile.logOut} kind="secondary" onPress={askToLogOut} />
        <Button title={t.common.delete} kind="danger" onPress={deleteAccount} busy={deleting} />
      </Row>
    </Screen>
  );
}
