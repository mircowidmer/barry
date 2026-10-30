import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, 'version-ranges.mjs');

describe('the version ranges in package.json', () => {
  let dir: string;
  const write = (name: string, json: object) => writeFileSync(join(dir, name), JSON.stringify(json));
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const run = (...args: string[]) => spawnSync('node', [script, ...args], { encoding: 'utf8' });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'barry-ranges-'));
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("keep only the major version, the minor below 1, Expo's exact pins and pinned prereleases", () => {
    const before = {
      dependencies: {
        expo: '~58.0.21',
        'maplibre-gl': '^6.16.0',
        leaflet: '^1',
        zod: '4.1',
        'react-native-web': '~0.21.0',
        tiny: '^0.0.3',
        react: '19.3.0',
        'date-fns': '4.1.0',
        'beta-lib': '1.0.0-beta.2',
      },
      devDependencies: { '@react-native/jest-preset': '^0.88.0-rc.4', typescript: '6' },
    };
    const after = {
      dependencies: {
        expo: '58',
        'maplibre-gl': '6',
        leaflet: '1',
        zod: '4',
        'react-native-web': '0.21',
        tiny: '0.0.3',
        react: '19.3.0',
        'date-fns': '4',
        'beta-lib': '1.0.0-beta.2',
      },
      devDependencies: { '@react-native/jest-preset': '0.88.0-rc.4', typescript: '6' },
    };
    write('package.json', before);
    write('package-lock.json', { lockfileVersion: 3, packages: { '': { name: 'barry', ...before } } });
    execFileSync('node', [script, join(dir, 'package.json')]);
    expect(read('package.json')).toEqual(after);
    expect(read('package-lock.json').packages['']).toEqual({ name: 'barry', ...after });
  });

  it('refuse ranges they cannot rewrite', () => {
    write('package.json', { dependencies: { leaflet: '>=1.9.4' } });
    const result = run('--check', join(dir, 'package.json'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('leaflet: ">=1.9.4"');
  });

  it('are already rewritten in the repository', () => {
    const result = run('--check', resolve(__dirname, '../package.json'));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
