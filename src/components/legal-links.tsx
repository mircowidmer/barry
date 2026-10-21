import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTexts } from '@/lib/texts';

const SITE = 'https://barry.support';

export const openPrivacy = () => Linking.openURL(`${SITE}/privacy`).catch(() => undefined);

export const openTerms = () => Linking.openURL(`${SITE}/terms`).catch(() => undefined);

export function LegalLinks() {
  const t = useTexts();
  return (
    <View style={styles.links}>
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" style={styles.link} onPress={openPrivacy}>
        {t.legal.privacy}
      </ThemedText>
      <ThemedText type="small" themeColor="accent" accessibilityRole="link" style={styles.link} onPress={openTerms}>
        {t.legal.terms}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  // Padding brings the 20-point text up to the 44-point hit target iOS asks for.
  link: { paddingVertical: 12, paddingHorizontal: Spacing.two },
});
