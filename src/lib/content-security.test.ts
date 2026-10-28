import { createHash } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import { contentSecurityPolicy, dropHtmlExtension, routerHydrate } from './content-security';

const hash = (script: string) => `'sha256-${createHash('sha256').update(script).digest('base64')}'`;

describe('contentSecurityPolicy', () => {
  const policy = contentSecurityPolicy('https://db.example');
  const directive = (name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `));

  it('runs the page’s own scripts and the two inline ones exactly, and no other inline script', () => {
    expect(directive('script-src')).toBe(`script-src 'self' ${hash(dropHtmlExtension)} ${hash(routerHydrate)}`);
  });

  it('lets the page reach only itself, Supabase and the map', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://db.example https://tiles.openfreemap.org");
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
  });
});
