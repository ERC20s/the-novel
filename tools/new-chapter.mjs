#!/usr/bin/env node
// tools/new-chapter.mjs — create a new chapter stub consistent with the project's template
//
// Usage:
//   node tools/new-chapter.mjs NN "Chapter Title" [--focal="Name"] [--dir=PATH] [--force]
//
// The repository root is resolved the same way every other tool in tools/ does it:
//   resolve(dirname(fileURLToPath(import.meta.url)), "..")
// A raw `new URL('.', import.meta.url).pathname` is percent-encoded (a checkout under
// "My Repo" arrives as ".../My%20Repo/...") and on Windows it arrives as "/C:/Users/...",
// so path.resolve produced a directory that does not exist and the write failed.
//
// --dir=PATH writes the stub somewhere other than chapters/ (resolved against the
// repository root; an absolute path is used as given) and creates the directory when
// it is missing. The Filename header is always written bare ("NN-title.md"), which
// tools/check-chapters.mjs accepts ("written either bare ... or under chapters/") and
// which stays correct whatever --dir is.
//
// Exit codes: 0 wrote the stub, 2 bad arguments, 3 the file already exists
// (never overwritten), 4 the write itself failed, 5 the chapter NUMBER (slot) is
// already claimed by another file (different title). Use --force to override.

import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = 'chapters';

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
  console.error('usage: node tools/new-chapter.mjs NN "Chapter Title" [--focal="Name"] [--dir=PATH] [--force]');
}

// One pass over the command line: flags never end up in the positional list.
function parseArgs(argv) {
  const args = { focal: null, dir: null, dirAsked: false, force: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--focal=')) {
      args.focal = a.slice('--focal='.length);
    } else if (a === '--focal') {
      args.focal = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i++;
    } else if (a.startsWith('--dir=')) {
      args.dirAsked = true;
      args.dir = a.slice('--dir='.length) || null;
    } else if (a === '--dir') {
      args.dirAsked = true;
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args.dir = next;
        i++; // the path belongs to --dir, never to the title
      } else {
        args.dir = null;
      }
    } else if (a === '--force') {
      args.force = true;
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
  const { nn, title, focal, dir, dirAsked, force } = parseArgs(argv);
  if (nn === undefined || title === undefined) {
    usage();
    process.exit(2);
  }
  if (dirAsked && !dir) {
    console.error('new-chapter: --dir needs a directory path, e.g. --dir=chapters');
    process.exit(2);
  }
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

  const outDir = resolve(REPO_ROOT, dir || DEFAULT_DIR);
  const filename = `${nn}-${s}.md`;
  const path = join(outDir, filename);
  if (existsSync(path)) {
    console.error(`refusing to overwrite existing file: ${path}`);
    process.exit(3);
  }

  // refuse to create a second file that claims the same two-digit slot
  try {
    if (existsSync(outDir)) {
      const files = readdirSync(outDir, { withFileTypes: false });
      for (const f of files) {
        const m = String(f).match(/^([0-9]{2})-(.+)\.md$/i);
        if (m && m[1] === nn) {
          if (!force) {
            console.error(`chapter ${nn} is already taken by ${f}\nrefuse to create a second file for the same slot. Either retitle with ` +
              "git mv OLDFILE NEWFILE, or pass --force to bypass this check");
            process.exit(5);
          } else {
            console.warn(`--force: writing despite an existing file claiming chapter ${nn} (${f})`);
            break;
          }
        }
      }
    }
  } catch (err) {
    // if reading the directory fails, continue — the later write will report an error
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
  headerLines.push(`Filename: ${filename}`);
  headerLines.push(`Title: ${titleStr}`);
  headerLines.push(`ChapterNumber: ${pad2(num)}`);
  headerLines.push(`TargetWords: 2000-3000`);
  headerLines.push(`ContinuityNotes: [describe beat(s) in outline.md]`);
  headerLines.push(`FocalCharacter: ${focal ? focal : '[Name]'}`);
  headerLines.push('');
  headerLines.push('<!-- Start writing the chapter below this line. Do not edit chapters/00-template.md. -->');
  headerLines.push('');

  try {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(path, headerLines.join('\n'), { flag: 'wx' });
    console.log(`wrote ${path}`);
    process.exit(0);
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      console.error(`refusing to overwrite existing file: ${path}`);
      process.exit(3);
    }
    console.error('failed to write file:', err && err.message ? err.message : String(err));
    process.exit(4);
  }
}

main();
