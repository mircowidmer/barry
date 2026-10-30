import { afterAll, describe, expect, it } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, 'version-ranges.mjs');

describe('the version ranges in package.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'barry-ranges-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('keep only the major version, the minor below 1, and exact pins as they are', () => {
    const file = join(dir, 'package.json');
    writeFileSync(
      file,
      JSON.stringify({
        dependencies: { expo: '~58.0.21', 'maplibre-gl': '^6.16.0', 'react-native-web': '~0.21.0', react: '19.3.0' },
        devDependencies: { '@react-native/jest-preset': '^0.88.0-rc.4', typescript: '6' },
      }),
    );
    execFileSync('node', [script, file]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      dependencies: { expo: '58', 'maplibre-gl': '6', 'react-native-web': '0.21', react: '19.3.0' },
      devDependencies: { '@react-native/jest-preset': '0.88', typescript: '6' },
    });
  });

  it('are already rewritten in the repository', () => {
    const result = spawnSync('node', [script, '--check', resolve(__dirname, '../package.json')], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
