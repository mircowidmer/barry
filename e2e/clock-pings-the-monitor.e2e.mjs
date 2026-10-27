import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { heartbeatsSince, sleep } from './stack.mjs';

// docs/adr/0001-server-owns-the-deadline.md "The Deadline check itself is a single point of failure. It reports to an
// outside monitor that alerts the operator when the reports stop."
// docs/spec.md § Monitoring
// health.e2e.mjs calls deliver itself. This case calls nothing: pg_cron runs the tick, the tick kicks deliver, and
// deliver pings the monitor. Files running beside this one also kick deliver, so the ping proves the chain only
// when this file runs alone; beside them, it still proves the clock ticks and a heartbeat follows.
const tickRuns = () =>
  JSON.parse(
    execFileSync(
      'npx',
      [
        'supabase', 'db', 'query', '--local', '-o', 'json',
        "select status, end_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'barry-tick') order by start_time desc limit 1",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  ).rows;

test('the clock’s tick reaches the monitor without anyone calling deliver', async () => {
  const start = new Date();
  let run;
  for (const deadline = Date.now() + 150_000; Date.now() < deadline; await sleep(5)) {
    [run] = tickRuns();
    if (run && new Date(run.end_time) > start) break;
    run = undefined;
  }
  assert.ok(run, 'pg_cron ran the tick within 150 seconds');
  assert.equal(run.status, 'succeeded', 'the tick succeeded');

  const ticked = new Date(run.end_time);
  let pings = [];
  for (const deadline = Date.now() + 30_000; Date.now() < deadline && pings.length === 0; await sleep(2)) {
    pings = (await heartbeatsSince(ticked)).filter((h) => new Date(h.at) - ticked < 30_000);
  }
  assert.ok(pings.length > 0, 'the monitor got a heartbeat within 30 seconds of the tick');
});
