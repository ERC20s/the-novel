#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_FILES = new Set(["00-template.md", "index.md", "readme.md"]);
const HEADER_KEYS = ["Filename", "Title", "ChapterNumber"];

function readIfPresent(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function readSlots() {
  const text = readIfPresent(join(REPO_ROOT, "outline.md"));
  if (text === null) return { slots: new Set(), source: null };
  const slots = new Set();
  for (const line of text.split(/\r?\n/)) {
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
  return { slots, source: "outline.md" };
}

function parseHeader(text) {
  const lines = text.split(/\r?\n/);
  const fields = {};
  let lastHeaderLine = -1;
  const limit = Math.min(lines.length, 40);
  for (let i = 0; i < limit; i++) {
    const m = lines[i].match(/^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (!HEADER_KEYS.includes(key)) continue;
    if (!(key in fields)) fields[key] = m[2].trim();
    lastHeaderLine = i;
  }
  const body = lines.slice(lastHeaderLine + 1).join("\n");
  return { fields, body };
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’'"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
  const out = { dir: null, jsonPath: null, nextOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--next") { out.nextOnly = true; continue; }
    if (a === "--json") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out.jsonPath = next; i++; } else { out.jsonPath = null; }
      continue;
    }
    if (a.startsWith("--json=")) { out.jsonPath = a.slice("--json=".length); continue; }
    if (!a.startsWith("--") && out.dir === null) {
      out.dir = a;
      continue;
    }
    // ignore unknown flags
  }
  return out;
}

function formatNN(n) {
  return String(n).padStart(2, "0");
}

function main(argv) {
  const { dir, jsonPath, nextOnly } = parseArgs(argv);
  const target = dir ? resolve(REPO_ROOT, dir) : join(REPO_ROOT, "chapters");

  const slots = readSlots();
  const files = existsSync(target)
    ? readdirSync(target).filter((f) => f.toLowerCase().endsWith(".md") && !SKIP_FILES.has(f.toLowerCase())).sort()
    : [];

  const seen = new Map(); // number -> { filename, title }
  const problems = [];

  for (const file of files) {
    const text = readIfPresent(join(target, file));
    if (text === null) continue;
    const { fields } = parseHeader(text);
    const nameMatch = file.match(/^(\d{2})-([a-z0-9-]+)\.md$/);
    const fileNumber = nameMatch ? Number(nameMatch[1]) : null;
    let n = null;
    if (fields.ChapterNumber && /^\d{1,3}$/.test(fields.ChapterNumber.trim())) {
      n = Number(fields.ChapterNumber.trim());
    } else if (fileNumber !== null) {
      n = fileNumber;
    }
    const title = fields.Title || null;
    if (n !== null) {
      seen.set(n, { filename: file, title });
    } else {
      problems.push(`file ${file} has no numeric ChapterNumber header and filename does not match NN-title.md`);
    }
  }

  const declared = [...slots.slots].sort((a, b) => a - b);
  const seenNumbers = [...seen.keys()].sort((a, b) => a - b);

  let missing = [];
  if (declared.length) {
    missing = declared.filter((s) => !seen.has(s));
  } else {
    // no declared slots: suggest lowest gap from 1..max or next after max
    const maxSeen = seenNumbers.length ? Math.max(...seenNumbers) : 0;
    // build missing as numbers from 1..maxSeen that are not present
    for (let i = 1; i <= maxSeen; i++) if (!seen.has(i)) missing.push(i);
  }

  const next = missing.length ? missing[0] : (declared.length ? null : (seenNumbers.length ? Math.max(...seenNumbers) + 1 : 1));

  if (nextOnly) {
    if (next === null) {
      console.log("");
      return 0;
    }
    console.log(formatNN(next));
    return 0;
  }

  // human friendly table
  if (declared.length) {
    console.log(`Declared slots from outline.md (${declared.length}):`);
    for (const s of declared) {
      if (seen.has(s)) {
        const e = seen.get(s);
        console.log(`${formatNN(s)} -> ${e.filename} — ${e.title || "(no Title header)"}`);
      } else {
        console.log(`${formatNN(s)} -> (empty)`);
      }
    }
  } else {
    console.log("No declared slots parsed from outline.md — listing chapter numbers observed in chapters/:\n");
    if (!seenNumbers.length) console.log("(none)");
    for (const n of seenNumbers) {
      const e = seen.get(n);
      console.log(`${formatNN(n)} -> ${e.filename} — ${e.title || "(no Title header)"}`);
    }
  }

  console.log("");
  if (missing.length) {
    console.log(`Missing slots: ${missing.map((n) => formatNN(n)).join(", ")}`);
  } else if (declared.length) {
    console.log("Missing slots: (none)");
  }
  console.log(`Suggested next slot: ${next !== null ? formatNN(next) : "(none)"}`);

  if (problems.length) {
    console.log("");
    console.log("Problems found parsing files:");
    for (const p of problems) console.log(`- ${p}`);
  }

  if (jsonPath) {
    try {
      const outPath = resolve(REPO_ROOT, jsonPath);
      const outDir = dirname(outPath);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const report = {
        declared: declared,
        seen: Object.fromEntries([...seen.entries()].map(([k, v]) => [k, v])),
        missing: missing,
        next: next,
        problems,
      };
      writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
      console.log(`\nwrote JSON report to ${outPath}`);
    } catch (err) {
      console.error("failed to write json report:", err && err.message ? err.message : String(err));
      return 2;
    }
  }

  return 0;
}

process.exit(main(process.argv.slice(2)));
