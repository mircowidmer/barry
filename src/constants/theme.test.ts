/// <reference types="node" />

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Colors } from './theme';

const css = readFileSync(join(__dirname, '../../web/site.css'), 'utf8');
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const light = css.slice(0, css.indexOf('@media'));

const shared = {
  '--bg': 'background',
  '--surface': 'backgroundElement',
  '--text': 'text',
  '--muted': 'textSecondary',
  '--accent': 'accent',
  '--on-accent': 'onAccent',
  '--border': 'backgroundSelected',
  '--warning': 'warning',
  '--danger': 'danger',
  '--success': 'success',
} as const;

function variable(block: string, name: string) {
  return block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1]?.toUpperCase();
}

describe('the website colours', () => {
  it.each(Object.entries(shared))('take %s from the app theme in light and dark', (name, color) => {
    expect(variable(light, name)).toBe(Colors.light[color]);
    expect(variable(dark, name)).toBe(Colors.dark[color]);
  });
});
