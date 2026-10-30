import { Group, InputRow } from '@/components/grouped-list';
import { ProfileEdit } from '@/components/profile-edit';
import { LIMITS } from '@/lib/barry';
import { phoneInput } from '@/lib/phone';
import { useTexts } from '@/lib/texts';

/** The sheet behind Edit on the Profile's header: the name and the phone number. */
export default function AboutYouSheet() {
  const t = useTexts();
  return (
    <ProfileEdit title={t.profile.about} sheet>
      {({ form, set }) => (
        <Group footer={t.profile.aboutFooter}>
          <InputRow
            label={t.profile.name}
            value={form.name}
            onChangeText={set('name')}
            maxLength={LIMITS.nameLength}
            placeholder={t.profile.required}
            autoComplete="name"
            textContentType="name"
          />
          <InputRow
            label={t.profile.phone}
            value={form.phone}
            onChangeText={(text) => set('phone')(phoneInput(text))}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </Group>
      )}
    </ProfileEdit>
  );
}
