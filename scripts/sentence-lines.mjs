#!/usr/bin/env node
// Puts each sentence of the repository's Markdown files on its own line, as AGENTS.md asks.
//
//   npm run sentences                          rewrites every tracked .md file
//   node scripts/sentence-lines.mjs --check    lists the lines that hold more than one sentence and exits 1
//   node scripts/sentence-lines.mjs FILE...    does either for the named files only
//
// Only prose moves: paragraphs, list items and block quotes. Front matter, fenced code, tables, headings,
// HTML and link definitions stay as they are. A sentence that continues a list item is indented to the
// item's text, and one inside a block quote keeps the quote marker, so the rendered page does not change.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Words that end with a full stop without ending the sentence.
const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|[ap]\.m|vs|cf|approx|ca|z\.\s?B|d\.\s?h|bzw|usw|Nr|Mr|Mrs|Ms|Dr|St|Mt|No|Fig)\.$/;

// A bold or italic label that opens a line, such as **Clock.**, which stays with the sentence it introduces.
const LABEL = /^(\*\*|__|\*|_)(?:(?!\1).)+\1$/;

// A piece that would start a new block if it began a line, so it stays on the line before.
const BLOCK_START = /^(?:[-*+]\s|\d+[.)]\s|#|>|\||<|```|~~~|=+$|-+$|\[[^\]]+\]:)/;

const SKIP = /^\s*(?:#|\||<|\[[^\]]+\]:\s)/;
const FENCE = /^((?:\s*>)*\s*)(`{3,}|~{3,})/;
const PREFIX = /^((?:[ \t]*>[ \t]?)*)([ \t]*)((?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/;

/** Replaces code spans, link targets and URLs with filler of the same length, so their stops never end a sentence. */
function mask(text) {
  const fill = (match) => match[0] + 'x'.repeat(match.length - 1);
  return text
    .replace(/(`+)[^`][\s\S]*?\1/g, fill)
    .replace(/\]\([^)]*\)/g, fill)
    .replace(/<[a-z]+:[^>]*>/gi, fill)
    .replace(/https?:\/\/[^\s)<>]*[^\s)<>.,;:!?'"]/g, fill);
}

/** Splits one line of prose into its sentences. */
function sentences(text) {
  const masked = mask(text);
  const boundary = /[.!?]["'”’)\]*_]*(\s+)(?=[A-Z0-9ÄÖÜ`*_"'“\[(])/g;
  const pieces = [];
  let start = 0;
  for (let match; (match = boundary.exec(masked)); ) {
    const end = match.index + match[0].length - match[1].length;
    const before = masked.slice(start, end).replace(/["'”’)\]*_]+$/, '');
    const next = text.slice(match.index + match[0].length);
    const label = start === 0 && LABEL.test(text.slice(0, end).trim());
    if (label || ABBREVIATION.test(before) || BLOCK_START.test(next)) continue;
    pieces.push(text.slice(start, end));
    start = match.index + match[0].length;
  }
  pieces.push(text.slice(start));
  return pieces;
}

/** Returns the Markdown with every sentence of its prose on its own line, and the numbers of the lines it split. */
function format(markdown) {
  const out = [];
  const split = [];
  const lines = markdown.split('\n');
  let fence = null;
  let frontMatter = lines[0] === '---';
  lines.forEach((line, index) => {
    if (frontMatter) {
      out.push(line);
      if (index > 0 && line === '---') frontMatter = false;
      return;
    }
    const opener = line.match(FENCE);
    if (fence) {
      if (opener && opener[2][0] === fence[0] && opener[2].length >= fence.length) fence = null;
      out.push(line);
      return;
    }
    if (opener) {
      fence = opener[2];
      out.push(line);
      return;
    }
    const [prefix, quote, indent, marker = ''] = line.match(PREFIX);
    const body = line.slice(prefix.length);
    if (!body.trim() || SKIP.test(line) || (!marker && indent.length >= 4 && !quote && out.at(-1) === '')) {
      out.push(line);
      return;
    }
    const pieces = sentences(body);
    if (pieces.length === 1) {
      out.push(line);
      return;
    }
    split.push(index + 1);
    const continuation = quote + indent + ' '.repeat(marker.length);
    pieces.forEach((piece, i) => {
      const last = i === pieces.length - 1;
      out.push((i === 0 ? prefix : continuation) + (last ? piece : piece.trimEnd()));
    });
  });
  return { markdown: out.join('\n'), split };
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const named = args.filter((arg) => arg !== '--check');
const files = named.length
  ? named
  : execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' }).split('\n').filter(Boolean);
let failed = false;
for (const file of files) {
  const { markdown, split } = format(readFileSync(file, 'utf8'));
  if (!split.length) continue;
  if (check) {
    failed = true;
    for (const line of split) console.error(`${file}:${line} holds more than one sentence`);
  } else {
    writeFileSync(file, markdown);
    console.log(`${file}: split ${split.length} line${split.length === 1 ? '' : 's'}`);
  }
}
if (failed) {
  console.error('Run npm run sentences to put each sentence on its own line.');
  process.exit(1);
}
