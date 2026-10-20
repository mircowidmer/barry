import '../../web/site.css';

import type { ReactNode } from 'react';
import { Image, StyleSheet } from 'react-native';

import { siteText, useSiteLanguage } from '@/lib/site-language';

export function SitePage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const t = siteText[useSiteLanguage()];
  return (
    <div className="site page">
      <header className="compact">
        <Image
          source={require('@/assets/images/logo.png')}
          accessibilityLabel={t.logo}
          style={styles.logo}
        />
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </header>
      <main>{children}</main>
    </div>
  );
}

const styles = StyleSheet.create({
  logo: { width: 72, height: 72, borderRadius: 17, marginHorizontal: 'auto', boxShadow: '0 0 0 2px rgb(255 255 255 / 0.85), 0 8px 24px rgb(0 0 0 / 0.2)' },
});
