import { useLocalSearchParams } from 'expo-router';

import { EndedAdventureScreen } from '@/components/ended-adventure-screen';
import { FirstLoad, Notice, Screen } from '@/components/form';
import { useLoad } from '@/hooks/use-load';
import { type AdventureId, barry } from '@/lib/barry';
import { useTexts } from '@/lib/texts';

export default function PastAdventureRoute() {
  const { id } = useLocalSearchParams<{ id: AdventureId }>();
  const loaded = useLoad(() => barry.getAdventure(id));
  const t = useTexts();

  if (loaded.data === undefined) {
    return (
      <Screen>
        <FirstLoad failure={loaded.error && t.common.couldNotReach(loaded.error.message)} onRetry={loaded.reload} />
      </Screen>
    );
  }
  if (loaded.data?.stage !== 'ended') {
    return (
      <Screen>
        <Notice tone="warning">{t.ended.notInHistory}</Notice>
      </Screen>
    );
  }
  return <EndedAdventureScreen adventure={loaded.data} />;
}
