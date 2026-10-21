import { barry } from '@/lib/barry';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { currentTexts } from '@/lib/texts';

const confirmed = () => {
  const t = currentTexts();
  return confirmDestructive({ title: t.dialogs.logOutTitle, message: t.dialogs.logOutMessage, action: t.profile.logOut });
};

export const askToLogOut = async () => {
  if (await confirmed()) await barry.logOut().catch(() => undefined);
};
