import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, 'changed-inputs.sh');

describe('the CI gate', () => {
  let repo: string;
  const shas: Record<string, string> = {};

  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  const commit = (name: string, file: string) => {
    mkdirSync(join(repo, file, '..'), { recursive: true });
    writeFileSync(join(repo, file), `${name}\n`);
    git('add', '-A');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', name);
    shas[name] = git('rev-parse', 'HEAD');
  };
  const outputs = (env: Record<string, string>) => {
    const out = execFileSync('bash', [script], { cwd: repo, env: { ...process.env, ...env }, encoding: 'utf8' });
    return Object.fromEntries(out.trim().split('\n').map((line) => line.split('=')));
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'barry-gate-'));
    git('init', '-q');
    commit('base', 'README.md');
    commit('docs', 'docs/spec.md');
    commit('backend', 'supabase/migrations/1.sql');
    commit('native', 'app.json');
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('changes both on every event but a pull request', () => {
    git('checkout', '-q', shas.docs!);
    expect(outputs({ EVENT: 'push' })).toEqual({ native: 'true', backend: 'true' });
    expect(outputs({ EVENT: 'workflow_dispatch' })).toEqual({ native: 'true', backend: 'true' });
  });

  it('skips both for a pull request that touches only documents, and each for its own inputs', () => {
    git('checkout', '-q', shas.docs!);
    expect(outputs({ EVENT: 'pull_request', BASE: shas.base! })).toEqual({ native: 'false', backend: 'false' });
    git('checkout', '-q', shas.backend!);
    expect(outputs({ EVENT: 'pull_request', BASE: shas.docs! })).toEqual({ native: 'false', backend: 'true' });
    git('checkout', '-q', shas.native!);
    expect(outputs({ EVENT: 'pull_request', BASE: shas.backend! })).toEqual({ native: 'true', backend: 'false' });
  });

  it('counts a diff it cannot take as changed, so a broken gate runs the checks', () => {
    git('checkout', '-q', shas.docs!);
    expect(outputs({ EVENT: 'pull_request', BASE: '0000000000000000000000000000000000000000' })).toEqual({ native: 'true', backend: 'true' });
    expect(outputs({ EVENT: 'pull_request' })).toEqual({ native: 'true', backend: 'true' });
  });
});
