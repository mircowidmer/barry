import '../../web/site.css';

import type { ReactNode } from 'react';
import { Image } from 'react-native';

export function SitePage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="site page">
      <header className="compact">
        <Image
          source={require('@/assets/images/logo.png')}
          accessibilityLabel="Barry's icon, a St. Bernard with a little barrel on its collar"
          style={{ width: 72, height: 72, borderRadius: 17, marginHorizontal: 'auto', boxShadow: '0 8px 24px rgb(0 0 0 / 0.2)' }}
        />
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </header>
      <main>{children}</main>
      <footer>
        <a href="/">Barry</a>. Go alone, get home.
      </footer>
    </div>
  );
}
