import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { contentSecurityPolicy, dropHtmlExtension } from '@/lib/content-security';

// Only the export: the development server's live reload needs what the policy forbids.
const policy = process.env.NODE_ENV === 'production' ? contentSecurityPolicy(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '') : null;

export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        {policy && <meta httpEquiv="Content-Security-Policy" content={policy} />}
        <meta name="referrer" content="no-referrer" />
        <script dangerouslySetInnerHTML={{ __html: dropHtmlExtension }} />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {headNodes}
        <ScrollViewStyleReset />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
