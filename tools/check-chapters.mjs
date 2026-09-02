#!/usr/bin/env node
// check-chapters.mjs — mechanical enforcement of the rules the group already wrote down.
//
// Rules come from the repository, never from this file:
//   - the cast is parsed from STYLE.md ("- Character: <Name>")
//   - the legal chapter slots are parsed from outline.md ("- Chapter 01:", "- Chapters 07-18:")
//   - the header fields and the Title/filename rule come from chapters/00-template.md
// Amending STYLE.md or outline.md by ordinary proposal therefore keeps this checker correct.
//
// Usage:
//   node tools/check-chapters.mjs [directory]        default: chapters/
//   node tools/check-chapters.mjs <dir> --expect-fail  exit 0 only if the scan DID report errors
//   node tools/check-chapters.mjs --report=tools/validation/REPORT.json  write a machine-readable report
//
// Exit code 0 = no errors. Warnings never fail the run: the template allows a noted
// deviation from the 2,000-3,000 word range, so word count is advisory and reviewers
// keep the final say.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FIELDS = ["Title", "ChapterNumber", "TargetWords", "ContinuityNotes", "FocalCharacter"];
const HEADER_KEYS = ["Filename", ...REQUIRED_FIELDS];
const MIN_WORDS = 2000;
const MAX_WORDS = 3000;
const SKIP_FILES = new Set(["00-template.md"]);

// ---------------------------------------------------------------- helpers

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’'"`]/g, "")     // curly and straight quotes just vanish
    .replace(/[^a-z0-9]+/g, "-")           // everything else becomes a separator
    .replace(/^-+|-+$/g, "");
}

function readIfPresent(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

// The cast, straight out of STYLE.md.
function readCast() {
  const text = readIfPresent(join(REPO_ROOT, "STYLE.md"));
  if (text === null) return { names: [], source: null };
  const names = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*Character:\s*(.+?)\s*$/);
    if (m && !names.includes(m[1])) names.push(m[1]);
  }
  return { names, source: "STYLE.md" };
}

// The legal chapter numbers, straight out of the outline.md chapter mapping.
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

// Front matter is plain text at the top of the file: the first run of "Key: value"
// lines. First occurrence of a key wins; the body is everything after the last one.
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

function countWords(body) {
  const words = body.replace(/[#*_>`]/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// ---------------------------------------------------------------- the check

function checkFile(dir, file, cast, slots, seenNumbers) {
  const errors = [];
  const warnings = [];
  const text = readFileSync(join(dir, file), "utf8");
  const { fields, body } = parseHeader(text);

  // 1. filename shape
  const nameMatch = file.match(/^(\d{2})-([a-z0-9-]+)\.md$/);
  if (!nameMatch) {
    errors.push(`filename must be NN-title.md (two digits, a hyphen, a lowercase slug): got "${file}"`);
  }
  const fileNumber = nameMatch ? Number(nameMatch[1]) : null;
  const fileSlug = nameMatch ? nameMatch[2] : null;

  // 1a. Filename header, if present, must match either the bare basename (NN-title.md)
  // or the repo-relative path chapters/NN-title.md. Be permissive about a leading
  // "./" or leading slash and about Windows backslashes.
  if (fields.Filename && fields.Filename.trim() !== "") {
    let raw = fields.Filename.trim();
    // normalize common prefixes and separators
    raw = raw.replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\\/g, "/");
    const acceptA = file; // e.g. 01-the-low-tide.md
    const acceptB = `chapters/${file}`; // e.g. chapters/01-the-low-tide.md
    if (raw !== acceptA && raw !== acceptB) {
      errors.push(
        `Filename header "${fields.Filename}" does not match the file; expected either "${acceptA}" or "${acceptB}" (repo-relative path or basename)"
      );
    }
  }

  // 2. required header fields
  for (const key of REQUIRED_FIELDS) {
    if (!(key in fields) || fields[key] === "") errors.push(`missing header field "${key}:"`);
  }

  // 3. leftover template placeholders anywhere in the header
  for (const [key, value] of Object.entries(fields)) {
    if (/\[[^\]]*\]/.test(value)) errors.push(`header field "${key}:" still holds a bracket placeholder: ${value}`);
  }
  if (/^(protagonist name|chapter title|name)$/i.test(fields.FocalCharacter || "")) {
    errors.push(`FocalCharacter is a placeholder ("${fields.FocalCharacter}"), not a cast name`);
  }

  // 4. Title slug must equal the filename slug
  if (fields.Title && fileSlug) {
    const titleSlug = slug(fields.Title);
    if (titleSlug !== fileSlug) {
      errors.push(`Title "${fields.Title}" slugs to "${titleSlug}" but the filename says "${fileSlug}"`);
    }
  }

  // 5. ChapterNumber must equal the filename NN, be unique, and sit in an outline slot
  if (fields.ChapterNumber) {
    const raw = fields.ChapterNumber.trim();
    if (!/^\d{1,3}$/.test(raw)) {
      errors.push(`ChapterNumber must be digits: got "${raw}"`);
    } else {
      const n = Number(raw);
      if (fileNumber !== null && n !== fileNumber) {
        errors.push(`ChapterNumber ${raw} does not match the filename number ${String(fileNumber).padStart(2, "0")}`);
      }
      if (seenNumbers.has(n)) {
        errors.push(`duplicate ChapterNumber ${raw} — also used by ${seenNumbers.get(n)}`);
      } else {
        seenNumbers.set(n, file);
      }
      if (slots.slots.size && !slots.slots.has(n)) {
        errors.push(`ChapterNumber ${raw} is not a slot in the outline.md chapter mapping`);
      }
    }
  }

  // 6. FocalCharacter must be a named cast member
  if (fields.FocalCharacter && cast.names.length && !cast.names.includes(fields.FocalCharacter)) {
    errors.push(
      `FocalCharacter "${fields.FocalCharacter}" is not in the STYLE.md Cast (${cast.names.join(", ")})`
    );
  }

  // 7. word count — advisory, per the template's "note deviations in ContinuityNotes"
  const words = countWords(body);
  if (words < MIN_WORDS || words > MAX_WORDS) {
    warnings.push(`${words} words, outside the 2,000-3,000 target — note the deviation in ContinuityNotes`);
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------- run

function main(argv) {
  const args = argv.filter((a) => a !== "--expect-fail");
  const expectFail = argv.includes("--expect-fail");

  // report parsing: accept --report=PATH or --report PATH
  let reportPath = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a && a.startsWith("--report=")) {
      reportPath = a.split("=", 2)[1] || null;
    } else if (a === "--report") {
      reportPath = argv[i + 1] || null;
    }
  }

  const target = args[0] ? resolve(REPO_ROOT, args[0]) : join(REPO_ROOT, "chapters");

  const cast = readCast();
  const slots = readSlots();

  if (!cast.names.length) console.log("note: no cast parsed from STYLE.md — the FocalCharacter check is off");
  if (!slots.slots.size) console.log("note: no chapter slots parsed from outline.md — the slot check is off");

  if (!existsSync(target)) {
    console.error(`check-chapters: no such directory: ${target}`);
    return expectFail ? 0 : 1;
  }

  const files = readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith(".md") && !SKIP_FILES.has(f))
    .sort();

  let errorCount = 0;
  let warningCount = 0;
  const seenNumbers = new Map();
  const filesWithErrors = [];

  const perFile = {};

  for (const file of files) {
    const { errors, warnings } = checkFile(target, file, cast, slots, seenNumbers);
    errorCount += errors.length;
    warningCount += warnings.length;
    perFile[file] = { errors, warnings };
    if (errors.length) filesWithErrors.push(file);
    if (!errors.length && !warnings.length) {
      console.log(`ok    ${file}`);
      continue;
    }
    for (const e of errors) console.log(`ERROR ${file}: ${e}`);
    for (const w of warnings) console.log(`warn  ${file}: ${w}`);
  }

  console.log(
    `\nchecked ${files.length} chapter file(s) in ${basename(target)}/ — ` +
      `${errorCount} error(s), ${warningCount} warning(s)`
  );

  const summary = `checked ${files.length} chapter file(s) in ${basename(target)}/ — ${errorCount} error(s), ${warningCount} warning(s)`;

  // If requested, write a machine-readable JSON report with per-file results and totals.
  if (reportPath) {
    try {
      const outPath = resolve(REPO_ROOT, reportPath);
      const outDir = dirname(outPath);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const report = {
        checked: files.length,
        errorCount,
        warningCount,
        files: perFile,
        summary,
      };
      writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
      console.log(`wrote report ${outPath}`);
    } catch (err) {
      console.error("failed to write report:", err && err.message ? err.message : String(err));
      // continue — do not change exit code for a failed write
    }
  }

  // Self-test convention: a fixture whose filename contains "broken" MUST produce
  // errors, and every other fixture MUST NOT. Warnings (word count) are ignored,
  // because fixtures are deliberately short.
  if (expectFail) {
    const expected = files.filter((f) => f.includes("broken"));
    const missed = expected.filter((f) => !filesWithErrors.includes(f));
    const falseAlarms = filesWithErrors.filter((f) => !f.includes("broken"));
    for (const f of missed) console.log(`self-test FAILED: ${f} should have been flagged and was not.`);
    for (const f of falseAlarms) console.log(`self-test FAILED: ${f} is a clean fixture but was flagged.`);
    if (!expected.length) console.log("self-test FAILED: no broken fixture found to exercise the checker.");
    if (missed.length || falseAlarms.length || !expected.length) return 1;
    console.log("self-test passed: the broken fixture was flagged and the clean fixture was not.");
    return 0;
  }
  return errorCount > 0 ? 1 : 0;
}

