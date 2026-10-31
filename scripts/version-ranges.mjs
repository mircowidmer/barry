// Keeps the ranges in package.json at the major version: "^6.16.0" becomes "6", and below 1,
// where the minor is the breaking part, "^0.21.4" becomes "0.21". A package Expo's
// bundledNativeModules.json lists, and expo itself, keeps the range Expo pins, such as "~58.0.21",
// because a wider one lets the lock file maintenance move it to a version the SDK does not support.
// A prerelease stays pinned. Rewrites the root entry of package-lock.json alongside, so the two
// files stay in sync.
// Usage: node scripts/version-ranges.mjs [--check] [path/to/package.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg.startsWith('-') && arg !== '--check');
if (unknown.length) {
  console.error(`Unknown option ${unknown.join(', ')}. Usage: node scripts/version-ranges.mjs [--check] [package.json]`);
  process.exit(1);
}
const check = args.includes('--check');
const file = args.find((arg) => !arg.startsWith('-')) ?? 'package.json';
const lockFile = join(dirname(file), 'package-lock.json');
const sections = ['dependencies', 'devDependencies'];

const require = createRequire(import.meta.url);
const expoVersions = (() => {
  try {
    return { ...require('expo/bundledNativeModules.json'), expo: `~${require('expo/package.json').version}` };
  } catch {
    return {};
  }
})();

const rangeFor = (name, version) => {
  const match = version.match(/^([~^]?)(\d+)(?:\.(\d+)(?:\.(\d+)(-[\w.]+)?)?)?$/);
  if (!match) return undefined;
  const [, prefix, major, minor = '0', patch = '0', prerelease] = match;
  // A range without the prerelease would match no prerelease at all, so it stays pinned.
  if (prerelease) return `${major}.${minor}.${patch}${prerelease}`;
  const expoRange = expoVersions[name];
  if (expoRange) {
    // Expo's own range is kept as written, so a patch the lock file moved to does not make it drift.
    if (match[4] && prefix === expoRange.match(/^[~^]?/)[0]) return version;
    return expoRange;
  }
  if (major !== '0') return major;
  // Below 0.1 every patch is breaking, as npm's own caret treats it.
  return minor === '0' ? `0.0.${patch}` : `0.${minor}`;
};

const json = JSON.parse(readFileSync(file, 'utf8'));
const drift = [];
const unreadable = [];
for (const section of sections) {
  for (const [name, version] of Object.entries(json[section] ?? {})) {
    const range = rangeFor(name, version);
    if (range === undefined) unreadable.push(`${name}: "${version}" is no version this script can rewrite`);
    else if (range !== version) {
      drift.push(`${name}: "${version}" should be "${range}"`);
      json[section][name] = range;
    }
  }
}

if (unreadable.length) {
  console.error(`${file} has ranges to write by hand as the major version.\n${unreadable.join('\n')}`);
  process.exit(1);
}
if (check) {
  if (drift.length) {
    console.error(`${file} has ranges other than the major version or Expo's. Run npm run versions.\n${drift.join('\n')}`);
    process.exit(1);
  }
} else if (drift.length) {
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  if (existsSync(lockFile)) {
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    const root = lock.packages?.[''];
    if (root) for (const section of sections) if (json[section]) root[section] = json[section];
    writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
  }
  console.log(drift.join('\n'));
}
