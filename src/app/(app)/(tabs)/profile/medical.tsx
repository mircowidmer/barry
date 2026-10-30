import { Group, TextAreaRow } from '@/components/grouped-list';
import { ProfileEdit } from '@/components/profile-edit';
import { LIMITS } from '@/lib/barry';
import { useTexts } from '@/lib/texts';

/** The medical notes an Alert carries, such as allergies or medication. */
export default function MedicalNotesScreen() {
  const t = useTexts();
  return (
    <ProfileEdit title={t.profile.medical}>
      {({ form, set }) => (
        <Group footer={t.profile.medicalFooter}>
          <TextAreaRow
            label={t.profile.medical}
            value={form.medicalNotes}
            onChangeText={set('medicalNotes')}
            maxLength={LIMITS.medicalNotesLength}
            placeholder={t.profile.medicalPlaceholder}
          />
        </Group>
      )}
    </ProfileEdit>
  );
}
