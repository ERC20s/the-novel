#!/usr/bin/env node
// test-cli.mjs — a regression test for how tools/check-chapters.mjs reads its
// command line. It exists because "npm run check:report" once died on its own
// flag: the --report argument was left in the positional list, so the checker
// tried to scan a directory literally named "--report=tools/validation/REPORT.json".
//
// The checker exits the process when it loads, so this test SPAWNS it rather
// than importing it, and asserts on exit codes and on the report it writes.
//
//   node tools/test-cli.mjs
//
// Exit code 0 = every case passed.

// It also guards the second trap the tools set for each other: build-toc.mjs writes
// chapters/INDEX.md INTO the folder check-chapters.mjs scans, so before the skip
// lists were widened, "npm run toc" followed by "npm run check" failed on a clean
// repository and the index listed itself.
//
// And it now covers tools/new-chapter.mjs, which used to resolve the repository root
// from a raw URL pathname (percent-encoded, and "/C:/..." on Windows). Every generator
// case writes into a temp directory via --dir, so chapters/ is never touched.
//
// The last trap it guards is the stub: the checker used to print "ok" for a file with a
// perfect header and no chapter in it. Cases 11 and 12 hold that line — a generated stub
// fails, a stub with its placeholders filled in STILL fails, and only real prose passes.
//
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "tools", "check-chapters.mjs");
const TOC_BUILDER = join(REPO_ROOT, "tools", "build-toc.mjs");
const GENERATOR = join(REPO_ROOT, "tools", "new-chapter.mjs");
const INDEX_MD = join(REPO_ROOT, "chapters", "INDEX.md");
const TOC_JSON = join(REPO_ROOT, "tools", "validation", "toc.json");

let failures = 0;

function fail(name, detail) {
  failures++;
  console.log(`FAILED ${name}: ${detail}`);
}

function pass(name) {
  console.log(`ok     ${name}`);
}

function runScript(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function run(args) {
  return runScript(CHECKER, args);
}

// Remember a working-tree file exactly as it is now, so the TOC cases below can
// put it back: a committed chapters/INDEX.md must survive this test unchanged,
// and a file this test created must not be left behind.
function snapshot(path) {
  if (!existsSync(path)) return { path, existed: false, content: null };
  try {
    return { path, existed: true, content: readFileSync(path, "utf8") };
  } catch {
    return { path, existed: true, content: null };
  }
}

function restore(snap) {
  if (!snap) return;
  try {
    if (snap.existed) {
      if (snap.content !== null) writeFileSync(snap.path, snap.content, "utf8");
    } else {
      rmSync(snap.path, { force: true });
    }
  } catch {
    /* a leftover generated file is not a test failure */
  }
}

function readReport(name, path) {
  if (!existsSync(path)) {
    fail(name, `no report written at ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(name, `report is not valid JSON: ${err && err.message ? err.message : String(err)}`);
    return null;
  }
}

function checkReportShape(name, report) {
  if (!report) return;
  if (typeof report.checked !== "number") return fail(name, "report has no numeric 'checked'");
  if (typeof report.errorCount !== "number") return fail(name, "report has no numeric 'errorCount'");
  if (!report.files || typeof report.files !== "object") return fail(name, "report has no 'files' object");
  if (report.errorCount !== 0) return fail(name, `chapters/ reported ${report.errorCount} error(s)`);
  pass(name);
}

const workDir = mkdtempSync(join(tmpdir(), "check-chapters-cli-"));
// The generator writes here, never into chapters/. "drafts" deliberately does not
// exist yet: --dir has to create it.
const genRoot = mkdtempSync(join(tmpdir(), "new-chapter-cli-"));
const genDir = join(genRoot, "drafts");
let indexSnap = null;
let tocSnap = null;

function runGenerator(args) {
  return runScript(GENERATOR, args);
}

// Chapter 07 is inside the "Chapters 07-18" slot in outline.md and "Mara Voss" is a
// "- Character:" line in STYLE.md, so the only errors the checker can report on a
// fresh stub are the two bracket placeholders the writer is meant to fill in.
const GEN_NN = "07";
const GEN_TITLE = "The Long Dark";
const GEN_FILE = "07-the-long-dark.md";
const GEN_FOCAL = "Mara Voss";

// Enough prose to clear the checker's stub floor (STUB_MIN_WORDS = 50) and nowhere near
// the 2,000-word warning line — a warning does not fail the run, an empty body now does.
// Not canon: this text never leaves the temp directory.
const PROSE = [
  "The tide went out at three in the morning and took the harbour lights with it.",
  "Mara logged the call, checked the board twice, and then went down to the water herself.",
  "The dock boards were slick and the ropes hung slack where a boat should have been.",
  "She wrote the time in the book, the way Dez had taught her, and waited for the radio.",
  "Nothing answered. The cove kept its own counsel, and the cold came up through her boots.",
  "By four she had walked the whole pier twice and found no wreckage at all.",
].join(" ");

try {
  // 1. positional directory + --report=PATH: the flag must not become the target.
  {
    const name = "--report=PATH writes a report and exits 0";
    const out = join(workDir, "equals.json");
    const { code, out: log } = run(["chapters", `--report=${out}`]);
    if (code !== 0) fail(name, `exit ${code}\n${log}`);
    else checkReportShape(name, readReport(name, out));
  }

  // 2. the spaced form must behave identically — the path is consumed by the flag.
  {
    const name = "--report PATH behaves identically";
    const out = join(workDir, "spaced.json");
    const { code, out: log } = run(["chapters", "--report", out]);
    if (code !== 0) fail(name, `exit ${code}\n${log}`);
    else checkReportShape(name, readReport(name, out));
  }

  // 3. no positional directory at all: chapters/ is still the default.
  {
    const name = "--report=PATH with no positional still scans chapters/";
    const out = join(workDir, "default.json");
    const { code, out: log } = run([`--report=${out}`]);
    if (code !== 0) fail(name, `exit ${code}\n${log}`);
    else checkReportShape(name, readReport(name, out));
  }

  // 4. a missing report path is a clear error, not a silent scan of nothing.
  {
    const name = "--report with no path exits 2";
    const { code, out: log } = run(["chapters", "--report"]);
    if (code !== 2) fail(name, `expected exit 2, got ${code}\n${log}`);
    else if (!/--report needs a file path/.test(log)) fail(name, `message not printed:\n${log}`);
    else pass(name);
  }

  // 5. the fixture self-test must still work alongside a report.
  {
    const name = "--expect-fail still passes with --report";
    const out = join(workDir, "fixtures.json");
    const { code, out: log } = run(["tools/fixtures", "--expect-fail", `--report=${out}`]);
    if (code !== 0) fail(name, `exit ${code}\n${log}`);
    else if (!/self-test passed/.test(log)) fail(name, `self-test line missing:\n${log}`);
    else pass(name);
  }

  // 6. the generated index must never list itself.
  //    build-toc.mjs writes chapters/INDEX.md, which then sits in the folder it
  //    scans; tools/validation/toc.json is the machine-readable copy of the same
  //    rows, so asserting on it also covers the markdown table.
  {
    const name = "npm run toc twice never lists INDEX.md as a chapter";
    indexSnap = snapshot(INDEX_MD);
    tocSnap = snapshot(TOC_JSON);

    const first = runScript(TOC_BUILDER, []);
    const second = runScript(TOC_BUILDER, []); // the second run is the one that used to self-list
    if (first.code !== 0 || second.code !== 0) {
      fail(name, `build-toc exited ${first.code}/${second.code}\n${first.out}${second.out}`);
    } else if (!existsSync(TOC_JSON)) {
      fail(name, `no toc written at ${TOC_JSON}`);
    } else {
      let rows = null;
      try {
        rows = JSON.parse(readFileSync(TOC_JSON, "utf8"));
      } catch (err) {
        fail(name, `toc.json is not valid JSON: ${err && err.message ? err.message : String(err)}`);
      }
      if (rows) {
        if (!Array.isArray(rows)) fail(name, "toc.json is not an array of chapter rows");
        else if (rows.some((r) => String((r && r.filename) || "").toLowerCase() === "index.md")) {
          fail(name, "toc.json contains an entry named INDEX.md");
        } else if (existsSync(INDEX_MD) && /\|\s*INDEX\.md\s*\|/i.test(readFileSync(INDEX_MD, "utf8"))) {
          fail(name, "chapters/INDEX.md lists itself as a chapter row");
        } else {
          pass(name);
        }
      }
    }
  }

  // 7. and the standard check must stay green once the index exists on disk.
  {
    const name = "npm run check exits 0 with chapters/INDEX.md present";
    if (!existsSync(INDEX_MD)) {
      fail(name, "build-toc did not write chapters/INDEX.md, so the case proves nothing");
    } else {
      const { code, out: log } = run(["chapters"]);
      if (code !== 0) fail(name, `exit ${code}\n${log}`);
      else if (/INDEX\.md/i.test(log)) fail(name, `the checker still reported INDEX.md:\n${log}`);
      else pass(name);
    }
  }
  // 8. the generator writes a stub — this is the case the broken REPO_ROOT failed.
  //    The temp path contains no percent-encoding tricks of its own, but the tool now
  //    resolves its own location with fileURLToPath, which is what a spaced or Windows
  //    checkout needs.
  {
    const name = "new-chapter writes a stub into --dir and exits 0";
    const { code, out: log } = runGenerator([GEN_NN, GEN_TITLE, `--dir=${genDir}`]);
    const written = join(genDir, GEN_FILE);
    if (code !== 0) fail(name, `exit ${code}\n${log}`);
    else if (!existsSync(written)) fail(name, `no file at ${written}\n${log}`);
    else {
      const text = readFileSync(written, "utf8");
      if (!/^Filename: 07-the-long-dark\.md$/m.test(text)) {
        fail(name, `Filename header is not the bare basename:\n${text.split("\n").slice(0, 6).join("\n")}`);
      } else if (!/^ChapterNumber: 07$/m.test(text) || !/^Title: The Long Dark$/m.test(text)) {
        fail(name, `header fields are wrong:\n${text.split("\n").slice(0, 6).join("\n")}`);
      } else {
        pass(name);
      }
    }
  }

  // 9. running it twice must never clobber a chapter someone is writing.
  {
    const name = "new-chapter refuses to overwrite and exits 3";
    const written = join(genDir, GEN_FILE);
    const before = existsSync(written) ? readFileSync(written, "utf8") : null;
    const { code, out: log } = runGenerator([GEN_NN, GEN_TITLE, `--dir=${genDir}`]);
    if (code !== 3) fail(name, `expected exit 3, got ${code}\n${log}`);
    else if (before === null) fail(name, "case 8 wrote nothing, so this case proves nothing");
    else if (readFileSync(written, "utf8") !== before) fail(name, "the existing file was modified");
    else pass(name);
  }

  // 9b. a second generator invocation with a different title must be refused with exit 5
  //      unless --force is provided; it must write no file in that slot.
  {
    const name = "new-chapter refuses to create a second file for the same slot and exits 5";
    const written = join(genDir, GEN_FILE);
    const second = runGenerator([GEN_NN, "A Different Title", `--dir=${genDir}`]);
    if (second.code !== 5) fail(name, `expected exit 5, got ${second.code}\n${second.out}`);
    else if (!existsSync(written)) fail(name, "original stub missing after refusal");
    else pass(name);
  }

  // 9c. providing --force allows writing a second file for the same slot into a fresh dir.
  {
    const name = "new-chapter --force writes despite a claimed slot";
    // make a fresh directory so the generator will create the file there; the
    // existing file in genDir should not be modified.
    const forcedRoot = mkdtempSync(join(tmpdir(), "new-chapter-force-"));
    const forcedDir = join(forcedRoot, "drafts");
    const before = existsSync(join(genDir, GEN_FILE)) ? readFileSync(join(genDir, GEN_FILE), "utf8") : null;
    const forced = runGenerator([GEN_NN, "A Different Title", `--dir=${forcedDir}`, "--force"]);
    const forcedPath = join(forcedDir, "07-a-different-title.md");
    if (forced.code !== 0) fail(name, `expected exit 0, got ${forced.code}\n${forced.out}`);
    else if (!existsSync(forcedPath)) fail(name, `no file written at ${forcedPath}`);
    else if (before !== null && readFileSync(join(genDir, GEN_FILE), "utf8") !== before) fail(name, "existing file was modified by --force case");
    else pass(name);
  }

  // 10. argument validation: the chapter number is two digits or nothing.
  {
    const name = "new-chapter rejects a one-digit chapter number with exit 2";
    const { code, out: log } = runGenerator(["7", "Seven", `--dir=${genDir}`]);
    if (code !== 2) fail(name, `expected exit 2, got ${code}\n${log}`);
    else if (existsSync(join(genDir, "7-seven.md")) || existsSync(join(genDir, "07-seven.md"))) {
      fail(name, "a file was written despite the bad argument");
    } else pass(name);
  }

  // 11. generator and checker must agree. A fresh stub draws three errors: the two
  //     bracket placeholders the writer fills in, plus the stub floor, because the whole
  //     body is the generator's HTML comment and comments are not prose. Filling the two
  //     placeholders is NOT enough — the file only goes green once real prose is in it.
  {
    const name = "checker flags the stub's placeholders and its empty body, then passes once written";
    const written = join(genDir, GEN_FILE);
    if (!existsSync(written)) {
      fail(name, "no generated stub to check");
    } else {
      const first = run([genDir]);
      const errors = first.out.split(/\r?\n/).filter((l) => l.startsWith("ERROR "));
      const placeholders = errors.filter((l) => /bracket placeholder/.test(l));
      const stubs = errors.filter((l) => /still a stub/.test(l));
      if (first.code !== 1) {
        fail(name, `expected exit 1 on the untouched stub, got ${first.code}\n${first.out}`);
      } else if (errors.length !== 3 || placeholders.length !== 2 || stubs.length !== 1) {
        fail(name, `expected two placeholder errors and one stub error, got:\n${errors.join("\n") || "(none)"}`);
      } else if (!errors.some((l) => /ContinuityNotes/.test(l)) || !errors.some((l) => /FocalCharacter/.test(l))) {
        fail(name, `the placeholder errors are not ContinuityNotes and FocalCharacter:\n${errors.join("\n")}`);
      } else if (!/no prose \(0 words/.test(stubs[0])) {
        fail(name, `the generator's comment was counted as prose:\n${stubs[0]}`);
      } else {
        const filled = readFileSync(written, "utf8")
          .replace(/^ContinuityNotes: .*$/m, "ContinuityNotes: follows the Act II development beat")
          .replace(/^FocalCharacter: .*$/m, `FocalCharacter: ${GEN_FOCAL}`);
        writeFileSync(written, filled, "utf8");

        // A correct header over an empty body must still fail: this is the whole point
        // of the floor.
        const second = run([genDir]);
        const stillStub = second.out.split(/\r?\n/).filter((l) => l.startsWith("ERROR "));
        if (second.code !== 1) {
          fail(name, `a filled-in header over an empty body must still fail, got exit ${second.code}\n${second.out}`);
        } else if (stillStub.length !== 1 || !/still a stub/.test(stillStub[0])) {
          fail(name, `expected only the stub error after filling the header, got:\n${stillStub.join("\n") || "(none)"}`);
        } else {
          // Now write prose. STUB_MIN_WORDS is 50 in tools/check-chapters.mjs; this
          // passage is comfortably over it and under the 2,000 warning line, so the run
          // must end clean (the word-count warning does not fail anything).
          writeFileSync(written, `${filled}\n${PROSE}\n`, "utf8");
          const third = run([genDir]);
          if (third.code !== 0) fail(name, `a written chapter still fails the checker:\n${third.out}`);
          else pass(name);
        }
      }
    }
  }

  // 12. the fixture pair says the same thing on its own: the empty fixture is reported
  //     as a stub by name, so npm test's --expect-fail case above cannot pass by accident.
  {
    const name = "tools/fixtures/04-broken-stub.md is reported as a stub";
    const { code, out: log } = run(["tools/fixtures"]);
    if (code !== 1) fail(name, `expected exit 1 on the fixture folder, got ${code}\n${log}`);
    else if (!/ERROR 04-broken-stub\.md: chapter has no prose \(0 words/.test(log)) {
      fail(name, `the empty fixture was not flagged as a stub:\n${log}`);
    } else if (/ERROR 01-the-low-tide\.md/.test(log)) {
      fail(name, `the clean fixture was flagged:\n${log}`);
    } else pass(name);
  }
  // 13. the word-count warning must honor a chapter's own validated TargetWords range
  //     instead of the hardcoded 2,000-3,000 default. Uses the same --dir mechanism as
  //     cases 8-11, but in a fresh directory and slot so it never collides with GEN_FILE.
  {
    const name = "word-count warning uses the chapter's own TargetWords range, not 2,000-3,000";
    const rangeRoot = mkdtempSync(join(tmpdir(), "new-chapter-range-"));
    const rangeDir = join(rangeRoot, "drafts");
    const RANGE_NN = "08";
    const RANGE_TITLE = "The Narrow Reach";
    const RANGE_FILE = "08-the-narrow-reach.md";
    const written = join(rangeDir, RANGE_FILE);

    const gen = runGenerator([RANGE_NN, RANGE_TITLE, `--dir=${rangeDir}`]);
    if (gen.code !== 0 || !existsSync(written)) {
      fail(name, `generator did not write the stub: exit ${gen.code}\n${gen.out}`);
    } else {
      const stub = readFileSync(written, "utf8")
        .replace(/^ContinuityNotes: .*$/m, "ContinuityNotes: follows the Act II development beat")
        .replace(/^FocalCharacter: .*$/m, `FocalCharacter: ${GEN_FOCAL}`)
        .replace(/^TargetWords: .*$/m, "TargetWords: 800-1200");

      // Exactly 950 whitespace-separated tokens: comfortably inside the declared
      // 800-1200 range and nowhere near the 2,000-3,000 default — proving the
      // chapter's own range, not the hardcoded one, is what governs the warning.
      const IN_RANGE = Array(950).fill("tide").join(" ");
      writeFileSync(written, `${stub}\n${IN_RANGE}\n`, "utf8");
      const inRange = run([rangeDir]);
      if (inRange.code !== 0) {
        fail(name, `an 800-1200 chapter with in-range prose should pass clean:\n${inRange.out}`);
      } else if (/outside the/.test(inRange.out)) {
        fail(name, `unexpected word-count warning on in-range prose:\n${inRange.out}`);
      } else {
        // Shorten below the declared low bound (800) but keep it over the stub floor
        // (50), and assert the warning cites 800-1200 — never the 2,000-3,000 default.
        const SHORT = Array(200).fill("tide").join(" ");
        writeFileSync(written, `${stub}\n${SHORT}\n`, "utf8");
        const short = run([rangeDir]);
        const warnLine = short.out.split(/\r?\n/).find((l) => /outside the/.test(l));
        if (short.code !== 0) {
          fail(name, `a word-count warning must not fail the run:\n${short.out}`);
        } else if (!warnLine) {
          fail(name, `expected a word-count warning under 800 words:\n${short.out}`);
        } else if (!/outside the 800-1,200 target/.test(warnLine)) {
          fail(name, `warning did not cite the chapter's own 800-1200 range:\n${warnLine}`);
        } else if (/2,000-3,000/.test(warnLine)) {
          fail(name, `warning still cites the hardcoded 2,000-3,000 default:\n${warnLine}`);
        } else {
          pass(name);
        }
      }
    }
    try {
      rmSync(rangeRoot, { recursive: true, force: true });
    } catch {
      /* a leftover temp directory is not a test failure */
    }

    // 14. diacritic titles slug consistently with the checker: generate a title
    //     containing a combining mark (Café) and assert the checker does not report
    //     a Title-vs-filename mismatch. The generated file is filled with prose so
    //     the checker can exercise the Title vs filename check without stub noise.
    {
      const name = "diacritic Title slugging (Café → cafe)";
      const diaRoot = mkdtempSync(join(tmpdir(), "new-chapter-diacritic-"));
      const diaDir = join(diaRoot, "drafts");
      const DIA_NN = "09";
      const DIA_TITLE = "Café Society";
      const DIA_FILE = "09-cafe-society.md";
      const written = join(diaDir, DIA_FILE);
      try {
        const gen = runGenerator([DIA_NN, DIA_TITLE, `--dir=${diaDir}`]);
        if (gen.code !== 0 || !existsSync(written)) {
          fail(name, `generator did not write the stub: exit ${gen.code}\n${gen.out}`);
        } else {
          const filled = readFileSync(written, "utf8")
            .replace(/^ContinuityNotes: .*$/m, "ContinuityNotes: diacritic slugging test")
            .replace(/^FocalCharacter: .*$/m, `FocalCharacter: ${GEN_FOCAL}`);
          writeFileSync(written, `${filled}\n${PROSE}\n`, "utf8");

          const res = run([diaDir]);
          if (res.code !== 0) fail(name, `checker failed after writing prose: exit ${res.code}\n${res.out}`);
          else if (/slugs to/.test(res.out) || /Title ".*" slugs to/.test(res.out)) {
            fail(name, `checker reported Title-vs-filename mismatch:\n${res.out}`);
          } else pass(name);
        }
      } finally {
        try { rmSync(diaRoot, { recursive: true, force: true }); } catch { }
      }
    }

    // 15. duplicate Title detection: two files whose Titles differ only by
    //     case/punctuation must be warned about. Files are given different
    //     chapter numbers but the same slug-based title so the checker should
    //     emit a duplicate-Title warning for both.
    {
      const name = "duplicate Title detection (case/punct)";
      const dupRoot = mkdtempSync(join(tmpdir(), "dup-title-"));
      const f1 = join(dupRoot, "10-a-moment.md");
      const f2 = join(dupRoot, "11-a-moment.md");
      const content1 = [
        "Filename: 10-a-moment.md",
        "Title: A Moment",
        "ChapterNumber: 10",
        "TargetWords: 2000-3000",
        "ContinuityNotes: test duplicate title",
        "FocalCharacter: Mara Voss",
        "",
        PROSE,
        "",
      ].join("\n");
      const content2 = [
        "Filename: 11-a-moment.md",
        "Title: a moment!",
        "ChapterNumber: 11",
        "TargetWords: 2000-3000",
        "ContinuityNotes: test duplicate title variant",
        "FocalCharacter: Mara Voss",
        "",
        PROSE,
        "",
      ].join("\n");
      try {
        writeFileSync(f1, content1, "utf8");
        writeFileSync(f2, content2, "utf8");

        const { code, out: log } = run([dupRoot]);
        if (code !== 0) fail(name, `exit ${code}\n${log}`);
        else if (!/duplicate Title/.test(log)) fail(name, `no duplicate Title warning printed:\n${log}`);
        else {
          const dupLines = log.split(/\r?\n/).filter((l) => /duplicate Title/.test(l));
          if (dupLines.length < 2) fail(name, `expected two duplicate warnings, got:\n${dupLines.join("\n") || "(none)"}`);
          else if (!dupLines.some((l) => l.includes("10-a-moment.md")) || !dupLines.some((l) => l.includes("11-a-moment.md"))) {
            fail(name, `warnings did not mention both files:\n${dupLines.join("\n")}`);
          } else pass(name);
        }
      } finally {
        try {
          rmSync(dupRoot, { recursive: true, force: true });
        } catch {
          /* a leftover temp directory is not a test failure */
        }
      }
    }
  }
} finally {
  // Put the working tree back the way it was found: restore a committed
  // INDEX.md / toc.json byte for byte, delete the ones this test created.
  restore(indexSnap);
  restore(tocSnap);
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* a leftover temp directory is not a test failure */
  }
  try {
    rmSync(genRoot, { recursive: true, force: true });
  } catch {
    /* a leftover temp directory is not a test failure */
  }
}

if (failures) {
  console.log(`\ncli test: ${failures} case(s) failed`);
  process.exit(1);
}
console.log("\ncli test: all cases passed");
process.exit(0);
