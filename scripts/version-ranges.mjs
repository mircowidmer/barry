// Keeps the ranges in package.json at the major version: "~58.0.21" becomes "58", and below 1,
// where the minor is the breaking part, "^0.21.4" becomes "0.21". Exact pins stay as they are.
// Usage: node scripts/version-ranges.mjs [--check] [path/to/package.json]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const file = args.find((arg) => arg !== '--check') ?? 'package.json';

const rangeFor = (version) => {
  const match = version.match(/^[~^](\d+)\.(\d+)/);
  if (!match) return version;
  const [, major, minor] = match;
  return major === '0' ? `0.${minor}` : major;
};

const json = JSON.parse(readFileSync(file, 'utf8'));
const drift = [];
for (const section of ['dependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(json[section] ?? {})) {
    const range = rangeFor(version);
    if (range === version) continue;
    drift.push(`${name}: "${version}" should be "${range}"`);
    json[section][name] = range;
  }
}

if (check) {
  if (drift.length) {
    console.error(`${file} has ranges beyond the major version. Run npm run versions.\n${drift.join('\n')}`);
    process.exit(1);
  }
} else if (drift.length) {
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(drift.join('\n'));
}
