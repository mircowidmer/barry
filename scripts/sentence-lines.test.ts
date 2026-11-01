import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const script = resolve(__dirname, 'sentence-lines.mjs');

describe('one sentence per line in Markdown', () => {
  let dir: string;
  const run = (...args: string[]) => spawnSync('node', [script, ...args], { cwd: root, encoding: 'utf8' });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'barry-sentences-'));
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('holds for every Markdown file in the repository', () => {
    const { status, stderr } = run('--check');
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('splits prose, keeps its rendering and leaves code, tables, headings and front matter alone', () => {
    const file = join(dir, 'page.md');
    writeFileSync(
      file,
      [
        '---',
        'description: Front matter stays. All of it.',
        '---',
        '# A heading stays. Even with two sentences.',
        '',
        'Barry owns the Deadline. The phone may be dead, e.g. in the cold. Run `npx supabase start`. `deliver` sends at 4 a.m. Zurich time.',
        '',
        '- **Clock.** pg_cron ticks. See [the spec](docs/spec.md). Then https://barry.support. Done!',
        '10. Ten. Eleven.',
        '> Quoted. Still quoted.',
        '',
        '| Cell. | Another. Cell. |',
        '| --- | --- |',
        '',
        '```sh',
        'echo one. Two.',
        '```',
        '',
        'Wait 5 minutes. 1. would start a list item at the start of a line.',
      ].join('\n'),
    );

    expect(run(file).status).toBe(0);

    expect(readFileSync(file, 'utf8')).toBe(
      [
        '---',
        'description: Front matter stays. All of it.',
        '---',
        '# A heading stays. Even with two sentences.',
        '',
        'Barry owns the Deadline.',
        'The phone may be dead, e.g. in the cold.',
        'Run `npx supabase start`.',
        '`deliver` sends at 4 a.m. Zurich time.',
        '',
        '- **Clock.** pg_cron ticks.',
        '  See [the spec](docs/spec.md).',
        '  Then https://barry.support.',
        '  Done!',
        '10. Ten.',
        '    Eleven.',
        '> Quoted.',
        '> Still quoted.',
        '',
        '| Cell. | Another. Cell. |',
        '| --- | --- |',
        '',
        '```sh',
        'echo one. Two.',
        '```',
        '',
        'Wait 5 minutes. 1. would start a list item at the start of a line.',
      ].join('\n'),
    );
  });

  it('names each line that holds more than one sentence, and changes nothing, under --check', () => {
    const file = join(dir, 'check.md');
    const before = 'One sentence.\n\nFirst. Second.\n';
    writeFileSync(file, before);

    const { status, stderr } = run('--check', file);

    expect(status).toBe(1);
    expect(stderr).toContain(`${file}:3 holds more than one sentence`);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
