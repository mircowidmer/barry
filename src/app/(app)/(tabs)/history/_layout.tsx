import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function HistoryLayout() {
  return <TabStack title={useTexts().history.title} />;
}
