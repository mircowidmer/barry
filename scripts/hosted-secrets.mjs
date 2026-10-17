// Sets the hosted project's function secrets from supabase/.env.hosted, and rotates DELIVER_SECRET in the
// function secrets and the Vault together. Prints secret names only, never values.
// Run from the linked checkout: node scripts/hosted-secrets.mjs
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const supabase = (...args) => execFileSync('npx', ['supabase', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const parseEnv = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^"(.*)"$/, '$1')]),
  );

const hosted = parseEnv(readFileSync('supabase/.env.hosted', 'utf8'));
for (const key of ['TRAIL_MAP_URL', 'RESEND_API_KEY', 'EMAIL_FROM', 'TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_FROM', 'HEALTHCHECK_URL']) {
  if (!hosted[key]) throw new Error(`supabase/.env.hosted has no ${key}`);
}
if ('TWILIO_API_URL' in hosted) throw new Error('Leave TWILIO_API_URL out of supabase/.env.hosted: deliver then sends to https://api.twilio.com');
if ('DELIVER_SECRET' in hosted) throw new Error('Leave DELIVER_SECRET out of supabase/.env.hosted: this script rotates it');

// `secrets set` also uploads every [edge_runtime.secrets] entry of config.toml, so the local-only ones come out again.
const config = readFileSync('supabase/config.toml', 'utf8');
const section = config.slice(config.indexOf('[edge_runtime.secrets]')).split(/\n\[/)[0];
const localOnly = [...section.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=/gm)]
  .map(([, key]) => key)
  .filter((key) => key !== 'DELIVER_SECRET' && !(key in hosted));

const deliverSecret = randomBytes(32).toString('hex');
const dir = mkdtempSync(join(tmpdir(), 'barry-secrets-'));
try {
  const envFile = join(dir, 'hosted.env');
  writeFileSync(envFile, Object.entries({ ...hosted, DELIVER_SECRET: deliverSecret }).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  supabase('secrets', 'set', '--env-file', envFile);
  if (localOnly.length > 0) supabase('secrets', 'unset', ...localOnly, '--yes');

  const sqlFile = join(dir, 'vault.sql');
  writeFileSync(sqlFile, `select vault.update_secret(id, '${deliverSecret}') from vault.secrets where name = 'deliver_secret';\n`, { mode: 0o600 });
  supabase('db', 'query', '--linked', '-f', sqlFile);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const secrets = JSON.parse(supabase('secrets', 'list', '-o', 'json')).filter((s) => !s.name.startsWith('SUPABASE_'));
const names = secrets.map((s) => s.name);
const digest = createHash('sha256').update(deliverSecret).digest('hex');
const problems = [
  ...localOnly.filter((key) => names.includes(key)).map((key) => `${key} is still set`),
  ...Object.keys(hosted).filter((key) => !names.includes(key)).map((key) => `${key} is missing`),
  ...(secrets.find((s) => s.name === 'DELIVER_SECRET')?.value === digest ? [] : ['DELIVER_SECRET does not match the new value']),
];
console.log(`hosted secrets: ${names.join(' ')}`);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('DELIVER_SECRET rotated in the function secrets and the Vault');
