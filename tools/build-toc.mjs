#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTERS_DIR = join(REPO_ROOT, 'chapters');
const OUT_INDEX = join(REPO_ROOT, 'chapters', 'INDEX.md');
const OUT_JSON = join(REPO_ROOT, 'tools', 'validation', 'toc.json');
// Not chapters: the template, a folder README, and this script's own output.
// The index used to list itself, because the generated INDEX.md sits in the very
// folder that is scanned. Names are compared lowercased, and the output file is
// skipped by its own basename rather than a hard-coded string, so moving OUT_INDEX
// can never re-open the hole.
const SKIP = new Set(['00-template.md', 'readme.md', basename(OUT_INDEX).toLowerCase()]);
const HEADER_KEYS = ['Filename', 'Title', 'ChapterNumber', 'TargetWords', 'ContinuityNotes', 'FocalCharacter'];

function readIf(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

function parseHeader(text) {
  const lines = text.split(/\r?\n/);
  const fields = {};
  let lastHeader = -1;
  const limit = Math.min(lines.length, 40);
  for (let i = 0; i < limit; i++) {
    const m = lines[i].match(/^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (!HEADER_KEYS.includes(key)) continue;
    if (!(key in fields)) fields[key] = m[2].trim();
    lastHeader = i;
  }
  const body = lines.slice(lastHeader + 1).join('\n');
  return { fields, body };
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’'"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writeIndex(items) {
  const lines = [];
  lines.push('# Chapter index');
  lines.push('');
  if (!items.length) {
    lines.push('No chapters found.');
    lines.push('');
    const text = lines.join('\n');
    const existing = readIf(OUT_INDEX);
    if (existing === null) {
      writeFileSync(OUT_INDEX, text, 'utf8');
      console.log(`wrote ${OUT_INDEX}`);
    } else if (existing !== text) {
      writeFileSync(OUT_INDEX, text, 'utf8');
      console.log(`updated ${OUT_INDEX}`);
    } else {
      console.log(`index unchanged: ${OUT_INDEX}`);
    }
    return;
  }
  lines.push('| # | Filename | Title | FocalCharacter | ContinuityNotes |');
  lines.push('|---:|---|---|---|---|');
  for (const it of items) {
    const num = it.chapterNumber != null ? String(it.chapterNumber).padStart(2, '0') : '';
    const file = it.filename || '';
    const title = (it.title || '').replace(/\|/g, '\\|');
    const focal = (it.focalCharacter || '');
    const notes = (it.continuityNotes || '').replace(/\|/g, '\\|');
    lines.push(`| ${num} | ${file} | ${title} | ${focal} | ${notes} |`);
  }
  lines.push('');
  const text = lines.join('\n');
  const existing = readIf(OUT_INDEX);
  if (existing === null) {
    writeFileSync(OUT_INDEX, text, 'utf8');
    console.log(`wrote ${OUT_INDEX}`);
  } else if (existing !== text) {
    writeFileSync(OUT_INDEX, text, 'utf8');
    console.log(`updated ${OUT_INDEX}`);
  } else {
    console.log(`index unchanged: ${OUT_INDEX}`);
  }
}

function writeJson(items) {
  const outDir = dirname(OUT_JSON);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const arr = items.map((it) => ({
    filename: it.filename,
    chapterNumber: it.chapterNumber,
    title: it.title,
    focalCharacter: it.focalCharacter,
    continuityNotes: it.continuityNotes,
  }));
  const jsonText = JSON.stringify(arr, null, 2) + '\n';
  const existing = readIf(OUT_JSON);
  if (existing === null) {
    writeFileSync(OUT_JSON, jsonText, 'utf8');
    console.log(`wrote ${OUT_JSON}`);
  } else if (existing !== jsonText) {
    writeFileSync(OUT_JSON, jsonText, 'utf8');
    console.log(`updated ${OUT_JSON}`);
  } else {
    console.log(`toc unchanged: ${OUT_JSON}`);
  }
}

function main() {
  const text = readIf(CHAPTERS_DIR);
  if (text === null && !existsSync(CHAPTERS_DIR)) {
    console.error('chapters/ directory not found');
    process.exit(1);
  }
  const files = readdirSync(CHAPTERS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md') && !SKIP.has(f.toLowerCase()))
    .sort();
  const items = [];
  for (const file of files) {
    const path = join(CHAPTERS_DIR, file);
    const src = readIf(path);
    if (src === null) continue;
    const { fields } = parseHeader(src);
    const title = fields.Title || '';
    const chapterNumber = fields.ChapterNumber ? Number(fields.ChapterNumber) : null;
    const focalCharacter = fields.FocalCharacter || '';
    const continuityNotes = fields.ContinuityNotes || '';
    items.push({ filename: file, chapterNumber, title, focalCharacter, continuityNotes });
  }
  // sort by chapterNumber then filename
  items.sort((a, b) => {
    const an = a.chapterNumber == null ? Infinity : a.chapterNumber;
    const bn = b.chapterNumber == null ? Infinity : b.chapterNumber;
    if (an !== bn) return an - bn;
    return a.filename.localeCompare(b.filename);
  });

  writeIndex(items);
  writeJson(items);
  console.log('build-toc: done');
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('build-toc.mjs — generate chapters/INDEX.md and tools/validation/toc.json');
  process.exit(0);
}

main();
