#!/usr/bin/env node
// tools/new-chapter.mjs — create a new chapter stub consistent with the project's template

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const CHAPTERS_DIR = join(REPO_ROOT, 'chapters');
const OUT_TEMPLATE = join(CHAPTERS_DIR, '00-template.md');

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’'"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function readSlots() {
  try {
    const src = readFileSync(join(REPO_ROOT, 'outline.md'), 'utf8');
    const slots = new Set();
    for (const line of src.split(/\r?\n/)) {
      const range = line.match(/^\s*-\s*Chapters\s+(\d{1,3})\s*[-–]\s*(\d{1,3})\s*:/i);
      if (range) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        for (let n = Math.min(from, to); n <= Math.max(from, to); n++) slots.add(n);
        continue;
      }
      const one = line.match(/^\s*-\s*Chapter\s+(\d{1,3})\s*:/i);
      if (one) slots.add(Number(one[1]));
    }
    return slots;
  } catch (err) {
    return new Set();
  }
}

function readCast() {
  try {
    const src = readFileSync(join(REPO_ROOT, 'STYLE.md'), 'utf8');
    const names = [];
    for (const line of src.split(/\r?\n/)) {
      const m = line.match(/^\s*-\s*Character:\s*(.+?)\s*$/);
      if (m && !names.includes(m[1])) names.push(m[1]);
    }
    return names;
  } catch (err) {
    return [];
  }
}

function usage() {
  console.error('usage: node tools/new-chapter.mjs NN "Chapter Title" [--focal="Name"]');
}

function parseArgs(argv) {
  const args = { focal: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--focal=')) {
      args.focal = a.split('=', 2)[1] || '';
    } else if (a === '--focal') {
      args.focal = argv[i + 1] || '';
      i++;
    } else {
      rest.push(a);
    }
  }
  args.nn = rest[0];
  args.title = rest[1];
  return args;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    usage();
    process.exit(2);
  }
  const { nn, title, focal } = parseArgs(argv);
  if (!/^[0-9]{2}$/.test(nn)) {
    console.error('chapter number must be two digits (e.g. 03)');
    process.exit(2);
  }
  const num = Number(nn);
  const titleStr = title || '';
  if (!titleStr.trim()) {
    console.error('chapter title is required');
    process.exit(2);
  }
  const s = slug(titleStr);
  if (!s) {
    console.error('could not create a slug from the title');
    process.exit(2);
  }
  const filename = `${nn}-${s}.md`;
  const path = join(CHAPTERS_DIR, filename);
  if (existsSync(path)) {
    console.error(`refusing to overwrite existing file: ${path}`);
    process.exit(3);
  }

  // warn if the slot is not declared in outline.md
  const slots = readSlots();
  if (slots.size && !slots.has(num)) {
    console.warn(`warning: chapter ${nn} is not declared as a slot in outline.md`);
  }

  // warn if focal supplied but not in cast
  const cast = readCast();
  if (focal && cast.length && !cast.includes(focal)) {
    console.warn(`warning: focal character "${focal}" is not listed in STYLE.md Cast`);
  }

  const headerLines = [];
  headerLines.push(`Filename: chapters/${filename}`);
  headerLines.push(`Title: ${titleStr}`);
  headerLines.push(`ChapterNumber: ${pad2(num)}`);
  headerLines.push(`TargetWords: 2000-3000`);
  headerLines.push(`ContinuityNotes: [describe beat(s) in outline.md]`);
  headerLines.push(`FocalCharacter: ${focal ? focal : '[Name]'}`);
  headerLines.push('');
  headerLines.push('<!-- Start writing the chapter below this line. Do not edit chapters/00-template.md. -->');
  headerLines.push('');

  try {
    writeFileSync(path, headerLines.join('\n'), { flag: 'wx' });
    console.log(`wrote ${path}`);
    process.exit(0);
  } catch (err) {
    console.error('failed to write file:', err && err.message ? err.message : String(err));
    process.exit(4);
  }
}

main();
