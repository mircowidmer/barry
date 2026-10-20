// Pushes the hosted project's settings from supabase/config.toml, where [remotes.hosted] overrides the local
// values, with the SMTP password from AUTH_SMTP_PASS in supabase/.env.hosted. The CLI shows each change and
// asks before it writes. Run from the linked checkout: node scripts/hosted-auth.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const hosted = Object.fromEntries(
  readFileSync('supabase/.env.hosted', 'utf8')
    .split('\n')
    .map((line) => line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^"(.*)"$/, '$1')]),
);
if (!hosted.AUTH_SMTP_PASS) throw new Error('supabase/.env.hosted has no AUTH_SMTP_PASS, the Resend key Auth sends its emails with');

const projectRef = readFileSync('supabase/config.toml', 'utf8').match(/^\[remotes\.hosted\]\nproject_id = "(\w+)"/m)?.[1];
if (!projectRef) throw new Error('supabase/config.toml has no [remotes.hosted] block with a project_id');

execFileSync('npx', ['supabase', 'config', 'push', '--project-ref', projectRef], {
  stdio: 'inherit',
  env: { ...process.env, AUTH_SMTP_PASS: hosted.AUTH_SMTP_PASS },
});
