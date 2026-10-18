import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function ProfileLayout() {
  return <TabStack title={useTexts().profile.title} />;
}
