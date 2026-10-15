// Stands in for Expo's push service during local development: accepts the request deliver
// sends to Expo and shows the notification in the booted iOS Simulator with `xcrun simctl push`.
// Run: node scripts/push-relay.mjs   (Supabase's config.toml points EXPO_PUSH_URL here)
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const PORT = 8787;
const BUNDLE_ID = 'support.barry';
const run = promisify(execFile);

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

createServer(async (request, response) => {
  const reply = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'POST' || request.url !== '/push') return reply(404, { error: 'not found' });

  try {
    const message = JSON.parse(await readBody(request));
    const payloadFile = join(tmpdir(), `barry-push-${randomUUID()}.apns`);
    await writeFile(
      payloadFile,
      JSON.stringify({ aps: { alert: { title: message.title, body: message.body }, sound: 'default' } }),
    );
    await run('xcrun', ['simctl', 'push', 'booted', BUNDLE_ID, payloadFile]);
    console.log(`pushed to simulator: ${message.title}`);
    reply(200, { data: { status: 'ok', id: `relay-${randomUUID()}` } });
  } catch (error) {
    console.error(`push failed: ${error.message}`);
    reply(200, { data: { status: 'error', message: error.message, details: { error: 'RelayFailed' } } });
  }
}).listen(PORT, () => console.log(`push relay listening on http://localhost:${PORT}/push`));
