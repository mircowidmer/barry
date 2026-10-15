import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

import { type Channel, parseFacts } from './facts.ts';
import { trailMapLinks } from './links.ts';
import { render } from './messages.en.ts';
import { type SendResult, senders } from './senders.ts';

type ClaimedRow = { id: number; attempts: number; channel: Channel; to_address: string };
type Health = { clock_ok: boolean; adventures_ok: boolean; outbox_ok: boolean };

const BATCH = 20;
const TIME_BUDGET_MS = 20_000;

const links = trailMapLinks(Deno.env.get('TRAIL_MAP_URL'));

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
};

const send = async (row: ClaimedRow): Promise<SendResult> => {
  try {
    const facts = parseFacts(await rpc('message_facts', { p_message_id: row.id }));
    return await senders[row.channel](row.to_address, render(facts, links), row.id);
  } catch (error) {
    return { outcome: 'retry', reason: error instanceof Error ? error.message : String(error) };
  }
};

const settle = (row: ClaimedRow, result: SendResult) =>
  rpc('settle_message', {
    p_id: row.id,
    p_attempt: row.attempts,
    p_outcome: result.outcome,
    p_provider_ref: result.outcome === 'sent' ? result.providerRef : null,
    p_reason: result.outcome === 'sent' ? null : result.reason,
    p_retry_after:
      result.outcome === 'retry' && result.retryAfterSeconds ? `${result.retryAfterSeconds} seconds` : null,
  });

const drain = async () => {
  const counts = { sent: 0, retry: 0, failed: 0 };
  const started = Date.now();
  while (Date.now() - started < TIME_BUDGET_MS) {
    const rows = await rpc<ClaimedRow[]>('claim_messages', { p_limit: BATCH });
    if (rows.length === 0) break;
    for (const row of rows) {
      const result = await send(row);
      await settle(row, result);
      counts[result.outcome] += 1;
    }
  }
  return counts;
};

const reportHealth = async (): Promise<Health> => {
  const [health] = await rpc<Health[]>('health');
  const url = Deno.env.get('HEALTHCHECK_URL');
  if (url) {
    const problems = Object.entries(health).filter(([, ok]) => !ok).map(([name]) => name);
    await fetch(problems.length === 0 ? url : `${url}/fail`, { method: 'POST', body: problems.join(', ') });
  }
  return health;
};

Deno.serve(async (request) => {
  if (request.headers.get('Authorization') !== `Bearer ${Deno.env.get('DELIVER_SECRET')}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const delivered = await drain();
  const health = await reportHealth();
  return Response.json({ delivered, health });
});
