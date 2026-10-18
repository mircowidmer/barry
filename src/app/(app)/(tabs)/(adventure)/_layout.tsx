import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function AdventureLayout() {
  return <TabStack title={useTexts().adventure.title} />;
}
