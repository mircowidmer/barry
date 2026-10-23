import { ActionRow, Group, InputRow } from '@/components/grouped-list';
import { ProfileEdit } from '@/components/profile-edit';
import { useTexts } from '@/lib/texts';

/** The car an Alert describes, so rescuers can find where the Adventurer parked. */
export default function CarScreen() {
  const t = useTexts();
  return (
    <ProfileEdit title={t.profile.car}>
      {({ form, set, save, saving }) => (
        <>
          <Group footer={t.profile.carFooter}>
            <InputRow label={t.profile.make} value={form.carMake} onChangeText={set('carMake')} />
            <InputRow label={t.profile.colour} value={form.carColour} onChangeText={set('carColour')} />
            <InputRow label={t.profile.plate} value={form.carPlate} onChangeText={set('carPlate')} autoCapitalize="characters" />
          </Group>
          {(form.carMake !== '' || form.carColour !== '' || form.carPlate !== '') && (
            <Group>
              <ActionRow
                title={t.profile.removeCar}
                tone="danger"
                disabled={saving}
                onPress={() => save({ carMake: '', carColour: '', carPlate: '' })}
              />
            </Group>
          )}
        </>
      )}
    </ProfileEdit>
  );
}
