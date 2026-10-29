#!/usr/bin/env node
// Prints where the time goes in the recent successful runs of ci.yml, read through gh.
// Usage: node .claude/skills/barry-continuous-integration-speed/scripts/timings.mjs [--runs N] [--workflow ci.yml] [--status success] [--json]
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const runs = Number(option('--runs', '20'));
const workflow = option('--workflow', 'ci.yml');
const status = option('--status', 'success');
const asJson = args.includes('--json');

const gh = (...argv) => {
  try {
    return JSON.parse(execFileSync('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    console.error(`gh failed: ${error.stderr?.trim() || error.message}`);
    console.error('Sign in with `gh auth login`, or estimate from the workflow and mark every number as an estimate.');
    process.exit(1);
  }
};

const seconds = (from, to) => (from && to ? Math.round((new Date(to) - new Date(from)) / 1000) : null);
const median = (values) => {
  const sorted = values.filter((v) => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
const clock = (s) => (s === null ? '-' : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);

const list = gh('run', 'list', '--workflow', workflow, '--status', status, '--limit', String(runs),
  '--json', 'databaseId,event,headBranch,createdAt,updatedAt');

const measured = list.map((run) => {
  const { jobs } = gh('run', 'view', String(run.databaseId), '--json', 'jobs');
  return {
    id: run.databaseId,
    kind: run.event === 'pull_request' ? 'pull request' : run.headBranch === 'main' ? 'main' : run.event,
    wallClock: seconds(run.createdAt, run.updatedAt),
    jobs: jobs
      .filter((job) => job.conclusion !== 'skipped')
      .map((job) => ({
        name: job.name,
        queued: seconds(run.createdAt, job.startedAt),
        duration: seconds(job.startedAt, job.completedAt),
        steps: job.steps.map((step) => ({ name: step.name, duration: seconds(step.startedAt, step.completedAt) })),
      })),
  };
});

const byKind = new Map();
for (const run of measured) {
  if (!byKind.has(run.kind)) byKind.set(run.kind, []);
  byKind.get(run.kind).push(run);
}

const summary = [...byKind].map(([kind, kindRuns]) => {
  const jobNames = [...new Set(kindRuns.flatMap((run) => run.jobs.map((job) => job.name)))];
  const jobs = jobNames.map((name) => {
    const samples = kindRuns.map((run) => run.jobs.find((job) => job.name === name)).filter(Boolean);
    const stepNames = [...new Set(samples.flatMap((job) => job.steps.map((step) => step.name)))];
    return {
      name,
      runs: samples.length,
      median: median(samples.map((job) => job.duration)),
      longest: Math.max(...samples.map((job) => job.duration ?? 0)),
      queued: median(samples.map((job) => job.queued)),
      steps: stepNames.map((stepName) => ({
        name: stepName,
        median: median(samples.map((job) => job.steps.find((step) => step.name === stepName)?.duration ?? null)),
      })),
    };
  });
  const criticalPath = jobs.reduce((longest, job) => (job.median > (longest?.median ?? -1) ? job : longest), null);
  return {
    kind,
    runs: kindRuns.length,
    wallClock: median(kindRuns.map((run) => run.wallClock)),
    criticalPath: criticalPath?.name ?? null,
    jobs: jobs.sort((a, b) => (b.median ?? 0) - (a.median ?? 0)),
  };
});

if (asJson) {
  console.log(JSON.stringify({ workflow, status, runs: measured, summary }, null, 2));
  process.exit(0);
}

console.log(`${workflow}: ${measured.length} ${status} runs`);
for (const kind of summary) {
  console.log(`\n## ${kind.kind} (${kind.runs} runs): median wall-clock ${clock(kind.wallClock)}, critical path ${kind.criticalPath ?? '-'}`);
  console.log('| job | runs | median | longest | queued | share of wall-clock |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const job of kind.jobs) {
    const share = kind.wallClock && job.median !== null ? `${Math.round((100 * job.median) / kind.wallClock)}%` : '-';
    console.log(`| ${job.name} | ${job.runs} | ${clock(job.median)} | ${clock(job.longest)} | ${clock(job.queued)} | ${share} |`);
  }
  for (const job of kind.jobs) {
    console.log(`\n### ${job.name}`);
    for (const step of job.steps.filter((s) => s.median !== null && s.median > 0).sort((a, b) => b.median - a.median)) {
      console.log(`- ${clock(step.median)}  ${step.name}`);
    }
  }
}
