import { Alert } from 'react-native';

import { openTerms } from '@/components/legal-links';
import { supabase } from '@/lib/supabase';
import { recordTermsSeen, termsDay, termsOutdated } from '@/lib/terms';
import { currentTexts } from '@/lib/texts';

let showing = false;

/**
 * Tells the Adventurer once that the Terms of Use changed, as web/terms.html promises. It waits while an Adventure is
 * in progress, so it never stands between the Adventurer and a Check-in. Both buttons record that they were told.
 */
export const tellAboutChangedTerms = async (adventureInProgress: () => Promise<boolean>) => {
  if (showing) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session || !termsOutdated(data.session.user)) return;
  if (await adventureInProgress()) return;
  if (showing) return;
  showing = true;
  const t = currentTexts();
  const seen = () => {
    showing = false;
    recordTermsSeen(supabase.auth).catch(() => undefined);
  };
  Alert.alert(t.legal.termsChangedTitle, t.legal.termsChanged(t.day(termsDay(), new Date())), [
    {
      text: t.legal.read,
      onPress: () => {
        seen();
        void openTerms();
      },
    },
    { text: t.legal.ok, style: 'cancel', onPress: seen },
  ]);
};
