import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTexts } from '@/lib/texts';

export const SITE = 'https://barry.support';

export function LegalLinks() {
  const t = useTexts();
  return (
    <View style={styles.links}>
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" onPress={() => Linking.openURL(`${SITE}/privacy`)}>
        {t.legal.privacy}
      </ThemedText>
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" onPress={() => Linking.openURL(`${SITE}/terms`)}>
        {t.legal.terms}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
});
