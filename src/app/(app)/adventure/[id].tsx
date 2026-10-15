import { useLocalSearchParams } from 'expo-router';

import { EndedAdventureScreen } from '@/components/ended-adventure-screen';
import { Button, Notice, Screen } from '@/components/form';
import { useLoad } from '@/hooks/use-load';
import { type AdventureId, barry } from '@/lib/barry';

export default function PastAdventureRoute() {
  const { id } = useLocalSearchParams<{ id: AdventureId }>();
  const loaded = useLoad(() => barry.getAdventure(id));

  if (loaded.status === 'error') {
    return (
      <Screen>
        <Notice tone="danger">Could not reach Barry. {loaded.error.message}</Notice>
        <Button title="Try again" onPress={loaded.reload} />
      </Screen>
    );
  }
  if (loaded.status === 'loading') return <Screen>{null}</Screen>;
  if (loaded.data?.stage !== 'ended') {
    return (
      <Screen>
        <Notice tone="warning">This Adventure is not in your history.</Notice>
      </Screen>
    );
  }
  return <EndedAdventureScreen adventure={loaded.data} />;
}
