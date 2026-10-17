// Stands in for Twilio's Messaging API and for Healthchecks.io during local development: accepts
// the text messages and the heartbeats deliver sends, prints them, and keeps them in memory for
// GET /messages and GET /healthchecks.
// Run: node scripts/sms-relay.mjs   (Supabase's config.toml points TWILIO_API_URL and HEALTHCHECK_URL here)
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = 8788;
const messages = [];
const heartbeats = [];

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
  if (request.method === 'GET' && request.url === '/messages') return reply(200, messages);
  if (request.method === 'GET' && request.url === '/healthchecks') return reply(200, heartbeats);
  if (request.method === 'POST' && /^\/healthcheck(\/fail)?$/.test(request.url ?? '')) {
    const heartbeat = { at: new Date().toISOString(), failed: request.url.endsWith('/fail'), body: await readBody(request) };
    heartbeats.push(heartbeat);
    if (heartbeat.failed) console.log(`heartbeat failed: ${heartbeat.body}`);
    return reply(200, 'OK');
  }
  if (request.method !== 'POST' || !/^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/.test(request.url ?? '')) {
    return reply(404, { code: 20404, message: 'The requested resource was not found', status: 404 });
  }
  if (!request.headers.authorization?.startsWith('Basic ')) {
    return reply(401, { code: 20003, message: 'Authenticate', status: 401 });
  }

  const form = new URLSearchParams(await readBody(request));
  const message = { sid: `SM${randomUUID().replaceAll('-', '')}`, status: 'queued', to: form.get('To'), from: form.get('From'), body: form.get('Body') };
  if (!message.to || !message.from || !message.body) {
    return reply(400, { code: 21604, message: "A 'To', 'From' and 'Body' are required", status: 400 });
  }
  messages.push(message);
  const [first, ...rest] = message.body.split('\n');
  console.log([`texted ${message.to} from ${message.from}: ${first}`, ...rest.map((line) => (line ? `  ${line}` : ''))].join('\n'));
  reply(201, message);
}).listen(PORT, () => console.log(`sms relay listening on http://localhost:${PORT}`));
