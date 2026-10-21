#!/usr/bin/env node
// test-rules.mjs — unit tests for the editor's checks (tools/editor-rules.mjs) and for
// how tools/check-chapters.mjs applies them.
//
//   node --test tools/test-rules.mjs
//
// The parsers and rules are pure, so they are imported and tested directly. The checker
// exits the process when it loads, so the end-to-end cases spawn it, the way
// tools/test-cli.mjs does, on the fixture folders in tools/fixtures/editor/:
//   pass/        must clear --strict with no error and no warning — every line in it is
//                something a rule must NOT flag (dialogue, italic thought, a hedged
//                guess, a spelling exception, a waived warning, a current INDEX.md)
//   fail-<rule>/ must fail --strict, and EVERY error must come from <rule>, so a fixture
//                cannot pass by tripping some other check by accident
// The rules come from tools/fixtures/editor/STYLE.md and outline.md (--style/--outline),
// so amending the novel's own STYLE.md or outline.md never breaks these tests.
//
// The last cases corrupt the committed chapters/INDEX.md and tools/validation/toc.json
// in place and put them back byte for byte, to prove TOC drift fails `npm run check`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  parseStyle,
  parseOutline,
  parseSpecRange,
  narration,
  editDistance,
  closestName,
  checkNames,
  checkBanned,
  checkPov,
  checkSpecRange,
  checkOutline,
  notesDeviation,
  allowedRules,
} from "./editor-rules.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "tools", "check-chapters.mjs");
const FIX = join(REPO_ROOT, "tools", "fixtures", "editor");
const STYLE = parseStyle(readFileSync(join(FIX, "STYLE.md"), "utf8"));
const OUTLINE = parseOutline(readFileSync(join(FIX, "outline.md"), "utf8"));
const RULES = ["--style=tools/fixtures/editor/STYLE.md", "--outline=tools/fixtures/editor/outline.md"];

function check(args) {
  const r = spawnSync(process.execPath, [CHECKER, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const lines = out.split(/\r?\n/);
  return {
    code: r.status,
    out,
    errors: lines.filter((l) => l.startsWith("ERROR ")),
    warnings: lines.filter((l) => l.startsWith("warn  ")),
  };
}

const rules = (findings) => findings.map((f) => f.rule).sort();

// ---------------------------------------------------------------- parsers

test("parseStyle reads cast, places, banned phrases and exceptions from the fixture STYLE.md", () => {
  assert.deepEqual(STYLE.cast, ["Mara Voss", "Dez Okafor", "Lena Voss"]);
  assert.deepEqual(STYLE.places, ["Amity Cove"]);
  assert.deepEqual(
    STYLE.banned.map((b) => [b.phrase, b.reason]),
    [
      ["little did she know", "omniscient commentary"],
      ["unbeknownst to", "omniscient commentary"],
      ["whilst", "archaism"],
    ]
  );
  assert.deepEqual([...STYLE.exceptions], ["Mary"]);
});

test("the novel's own STYLE.md, outline.md and template parse into usable rules", () => {
  const style = parseStyle(readFileSync(join(REPO_ROOT, "STYLE.md"), "utf8"));
  assert.ok(style.cast.includes("Mara Voss"), `cast parsed as ${JSON.stringify(style.cast)}`);
  assert.ok(style.places.includes("Amity Cove"), `places parsed as ${JSON.stringify(style.places)}`);
  assert.ok(style.banned.length > 0, "no banned phrases parsed from STYLE.md");
  const outline = parseOutline(readFileSync(join(REPO_ROOT, "outline.md"), "utf8"));
  assert.equal(outline.slots.size, 24);
  assert.deepEqual(parseSpecRange(readFileSync(join(REPO_ROOT, "chapters", "00-template.md"), "utf8")), { low: 2000, high: 3000 });
});

test("parseOutline reads slots and fixes titles only for single-chapter slots", () => {
  assert.deepEqual([...OUTLINE.slots].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...OUTLINE.titles], [[1, "The Quiet Log"], [3, "Slack Water"]]);
  const stray = parseOutline("- Chapters 01-02: a range\n  - Title: Not Fixed\n- Chapter 03: one\nNotes\n  - Title: Not Fixed Either\n");
  assert.equal(stray.titles.size, 0, "a Title under a range line or outside a chapter must not be read");
});

test("parseSpecRange rejects a missing or inverted range", () => {
  assert.equal(parseSpecRange("no range here"), null);
  assert.equal(parseSpecRange("TargetWords: 3000-2000"), null);
});

// ---------------------------------------------------------------- helpers

test("narration blanks dialogue, italics, block quotes and comments but keeps line numbers", () => {
  const src = 'She said, "I know."\n*We should go,* she thought.\n> I was here.\n<!-- I -->Then she left.\n“An open quote\nruns to the paragraph end\n\nNarration again.';
  const out = narration(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split("\n").length, src.split("\n").length);
  assert.doesNotMatch(out, /\bI\b|\bWe\b|open quote|paragraph end/);
  assert.match(out, /She said,/);
  assert.match(out, /Then she left\./);
  assert.match(out, /Narration again\./);
});

test("narration blanks italic thought that wraps onto the next line, but not past a blank line", () => {
  // Chapters are hard-wrapped, so a thought often wraps. Unblanked, the wrapped span also
  // threw the * pairing off, exposing the NEXT italic span as narration.
  const src = "Mara keyed the mic. *I should have called\nit in,* she thought. *Whilst there was light.*\n_We were\nlate,_ she knew.";
  assert.deepEqual(checkPov(src, "Mara Voss", STYLE), []);
  assert.deepEqual(checkBanned(src, STYLE), []);
  assert.deepEqual(checkBanned("Mara waited. *Not whilst\nDez is out there,* she thought.", STYLE), []);
  const twoParagraphs = "Mara saw one *star.\n\nI waited whilst she counted. Then a second* one.";
  assert.deepEqual(rules(checkPov(twoParagraphs, "Mara Voss", STYLE)), ["pov-first-person"]);
  assert.deepEqual(rules(checkBanned(twoParagraphs, STYLE)), ["banned-phrase"]);
});

test("editDistance counts a transposition as one edit", () => {
  assert.equal(editDistance("Ridge", "Rigde"), 1);
  assert.equal(editDistance("Mara", "Marra"), 1);
  assert.equal(editDistance("Okafor", "Okafur"), 1);
  assert.equal(editDistance("Mara", "Lena"), 3);
});

test("closestName suggests a near cast name and nothing for a stranger", () => {
  assert.equal(closestName("Mara Vos", STYLE.cast), "Mara Voss");
  assert.equal(closestName("Thomas Ridge", STYLE.cast), null);
});

// ---------------------------------------------------------------- names

test("checkNames flags near-misses, crossed names and wrong case", () => {
  const f = checkNames("He saw Marra at the dock. Then Mara Okafor called from Amity cove, and Dez Okafur hung up.", STYLE);
  assert.deepEqual(rules(f), ["name-crossed", "name-spelling", "name-spelling", "name-spelling"]);
  const text = f.map((x) => x.message).join("\n");
  assert.match(text, /"Marra" looks like a misspelling of "Mara"/);
  assert.match(text, /"Mara Okafor" crosses two names/);
  assert.match(text, /"Amity cove" should be written "Amity Cove"/);
  assert.match(text, /"Dez Okafur" looks like a misspelling of "Dez Okafor"/);
  assert.ok(f.every((x) => x.level === "warn"));
});

test("checkNames leaves correct names, sentence starts, exceptions and other initials alone", () => {
  const f = checkNames("Mara Voss and Lena Voss met at Amity Cove. Calm water. Her friend Mary waved, and the Boss nodded. Mara's log was full.", STYLE);
  assert.deepEqual(f, []);
});

test("checkNames treats a word after a closing quote, bracket or ellipsis that ends a sentence as sentence-initial", () => {
  const f = checkNames("“Say anything.”\n\nCave lights came on. She read the sign: ‘Closed.’ Mark the time. (It was late.) Cave water. She waited… Mark it.", STYLE);
  assert.deepEqual(f, []);
  // a closing quote with no full stop before it is still mid-sentence
  assert.deepEqual(rules(checkNames("She called it the “harbor” Marra liked.", STYLE)), ["name-spelling"]);
});

test("checkNames reports line numbers in the file, offset past the header", () => {
  const [f] = checkNames("line one\nthe log named Marra", STYLE, 6);
  assert.match(f.message, /line 8\)/);
});

// ---------------------------------------------------------------- banned phrases

test("checkBanned fails a banned phrase in narration, case-insensitively and across a line break", () => {
  const f = checkBanned("Unbeknownst\nto Mara, the boat was gone. She waited whilst it rained.", STYLE);
  assert.deepEqual(rules(f), ["banned-phrase", "banned-phrase"]);
  assert.ok(f.every((x) => x.level === "error"));
});

test("checkBanned ignores banned phrases in dialogue and inside longer words", () => {
  assert.deepEqual(checkBanned('"I waited whilst you slept," she said. The whilstle blew.', STYLE), []);
});

// ---------------------------------------------------------------- point of view

test("checkPov flags first-person narration but not first person in dialogue or italic thought", () => {
  assert.deepEqual(rules(checkPov("Mara looked. I saw the boat.", "Mara Voss", STYLE)), ["pov-first-person"]);
  assert.deepEqual(checkPov('Mara looked. "I saw it," she said. *My boat,* she thought.', "Mara Voss", STYLE), []);
});

test("checkPov flags another character's interior but not a hedged guess or the focal's own", () => {
  assert.deepEqual(rules(checkPov("Mara watched. Dez knew the tide was wrong.", "Mara Voss", STYLE)), ["pov-head-hop"]);
  assert.deepEqual(rules(checkPov("Mara watched. Okafor's thoughts were elsewhere.", "Mara Voss", STYLE)), ["pov-head-hop"]);
  assert.deepEqual(checkPov("Mara knew. She wondered whether Dez knew.", "Mara Voss", STYLE), []);
});

test("checkPov uses a shared surname for nobody", () => {
  // Mara and Lena are both Voss, so "Voss knew" cannot be pinned on Lena in a Mara chapter.
  assert.deepEqual(checkPov("Mara watched. Voss knew.", "Mara Voss", STYLE), []);
});

test("checkPov flags a chapter that never names its focal character", () => {
  assert.deepEqual(rules(checkPov("The tide went out.", "Mara Voss", STYLE)), ["pov-focal-absent"]);
  assert.deepEqual(checkPov("The tide went out on Mara.", "Mara Voss", STYLE), []);
});

// ---------------------------------------------------------------- words, outline, waivers

test("checkSpecRange flags a declared range outside the spec and accepts one inside it", () => {
  const spec = { low: 2000, high: 3000 };
  assert.deepEqual(rules(checkSpecRange(800, 1200, spec)), ["words-spec"]);
  assert.deepEqual(rules(checkSpecRange(2500, 3500, spec)), ["words-spec"]);
  assert.deepEqual(checkSpecRange(2200, 2800, spec), []);
  assert.equal(notesDeviation("Act II beat. Deviation: interlude at 1,000 words"), true);
  assert.equal(notesDeviation("Act II beat, no deviations"), false);
});

test("checkOutline reports title mismatches, gaps and the unwritten tail", () => {
  const { perFile, findings } = checkOutline(
    [
      { file: "01-the-loud-log.md", number: 1, title: "The Loud Log" },
      { file: "03-slack-water.md", number: 3, title: "Slack Water" },
    ],
    OUTLINE
  );
  assert.deepEqual([...perFile.keys()], ["01-the-loud-log.md"]);
  assert.deepEqual(rules(perFile.get("01-the-loud-log.md")), ["outline-title"]);
  assert.deepEqual(findings.map((f) => [f.rule, f.level]), [["outline-gap", "warn"], ["outline-unwritten", "note"]]);
  assert.match(findings[0].message, /slot 02/);
  assert.match(findings[1].message, /slots 04-06/);
  const { findings: none } = checkOutline([], OUTLINE);
  assert.deepEqual(none.map((f) => f.level), ["note"], "an unstarted novel has only notes");
});

test("allowedRules reads every rule a chapter waives", () => {
  assert.deepEqual([...allowedRules("<!-- check-chapters: allow pov-head-hop, name-spelling -->")], ["pov-head-hop", "name-spelling"]);
  assert.deepEqual([...allowedRules("<!-- allow pov-head-hop -->")], []);
});

// ---------------------------------------------------------------- the checker on the fixtures

test("pass/ clears --strict with no error and no warning", () => {
  const r = check(["tools/fixtures/editor/pass", "--strict", ...RULES]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

// [folder, the pattern EVERY error line must match, does the plain (non-strict) check fail too?]
const FAILING = [
  ["fail-name-spelling", /\[name-spelling\]/, false],
  ["fail-name-crossed", /\[name-crossed\]/, false],
  ["fail-banned-phrase", /\[banned-phrase\] "whilst"/, true],
  ["fail-pov-first-person", /\[pov-first-person\]/, false],
  ["fail-pov-head-hop", /\[pov-head-hop\] "Dez knew"/, false],
  ["fail-pov-focal-absent", /\[pov-focal-absent\]/, false],
  ["fail-outline-title", /\[outline-title\] Title "The Loud Log"/, true],
  ["fail-outline-gap", /^ERROR outline: \[outline-gap\] slot 02/, false],
  ["fail-orphan", /\[orphan\] "02-the-cold-pier\.txt"/, true],
  ["fail-words-spec", /\[words-spec\] TargetWords 60-400/, false],
  ["fail-words-target", /words, outside the 2,000-3,000 target/, false],
  ["fail-toc-drift", /^ERROR toc: \[toc-drift\] .*fail-toc-drift\/INDEX\.md does not match/, true],
];

for (const [folder, pattern, failsPlain] of FAILING) {
  test(`${folder}/ fails --strict on that rule alone`, () => {
    const r = check([`tools/fixtures/editor/${folder}`, "--strict", ...RULES]);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.errors.length > 0, `no ERROR line:\n${r.out}`);
    for (const e of r.errors) assert.match(e, pattern, `an error from another rule:\n${r.out}`);
  });

  test(`${folder}/ ${failsPlain ? "also fails" : "only warns under"} plain npm run check`, () => {
    const r = check([`tools/fixtures/editor/${folder}`, ...RULES]);
    if (failsPlain) {
      assert.equal(r.code, 1, r.out);
      assert.ok(r.errors.some((e) => pattern.test(e)), r.out);
    } else {
      assert.equal(r.code, 0, r.out);
      assert.deepEqual(r.errors, []);
      assert.ok(r.warnings.some((w) => pattern.test(w.replace(/^warn  /, "ERROR "))), `no matching warning:\n${r.out}`);
    }
  });
}

test("a waiver cannot silence an error rule", () => {
  // pass/02 waives pov-head-hop; the same comment naming banned-phrase must not clear fail-banned-phrase.
  const src = readFileSync(join(FIX, "fail-banned-phrase", "01-the-quiet-log.md"), "utf8");
  assert.match(src, /whilst/);
  const waived = src.replace(/\n\n/, "\n\n<!-- check-chapters: allow banned-phrase -->\n\n");
  const tmp = join(FIX, "fail-banned-phrase", "01-the-quiet-log.md");
  try {
    writeFileSync(tmp, waived, "utf8");
    const res = check(["tools/fixtures/editor/fail-banned-phrase", ...RULES]);
    assert.equal(res.code, 1, res.out);
    assert.ok(res.errors.some((e) => /\[banned-phrase\]/.test(e)), res.out);
  } finally {
    writeFileSync(tmp, src, "utf8");
  }
});

test("--style and --outline with no path, or a missing file, exit 2", () => {
  assert.equal(check(["tools/fixtures/editor/pass", "--style"]).code, 2);
  assert.equal(check(["tools/fixtures/editor/pass", "--outline="]).code, 2);
  assert.equal(check(["tools/fixtures/editor/pass", "--style=tools/fixtures/editor/NOPE.md"]).code, 2);
});

// ---------------------------------------------------------------- TOC drift on the real chapters/

function withFileChanged(path, change, fn) {
  const existed = existsSync(path);
  const before = existed ? readFileSync(path, "utf8") : null;
  try {
    change();
    fn();
  } finally {
    if (existed) writeFileSync(path, before, "utf8");
    else rmSync(path, { force: true });
  }
}

const INDEX_MD = join(REPO_ROOT, "chapters", "INDEX.md");
const TOC_JSON = join(REPO_ROOT, "tools", "validation", "toc.json");

test("npm run check passes on chapters/ with the committed index", () => {
  const r = check([]);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /toc-drift/);
});

test("a stale chapters/INDEX.md fails npm run check", () => {
  withFileChanged(INDEX_MD, () => writeFileSync(INDEX_MD, readFileSync(INDEX_MD, "utf8") + "| 99 | stale row |\n", "utf8"), () => {
    const r = check([]);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.errors.some((e) => /^ERROR toc: \[toc-drift\] chapters\/INDEX\.md does not match/.test(e)), r.out);
  });
});

test("a missing tools/validation/toc.json fails npm run check", () => {
  withFileChanged(TOC_JSON, () => rmSync(TOC_JSON, { force: true }), () => {
    const r = check([]);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.errors.some((e) => /^ERROR toc: \[toc-drift\] tools\/validation\/toc\.json is missing/.test(e)), r.out);
  });
});

test("npm run toc runs when the checkout is reached through a symlink", () => {
  const dir = mkdtempSync(join(tmpdir(), "novel-link-"));
  const link = join(dir, "repo");
  const before = [readFileSync(INDEX_MD, "utf8"), readFileSync(TOC_JSON, "utf8")];
  try {
    symlinkSync(REPO_ROOT, link, "dir");
    const r = spawnSync(process.execPath, [join(link, "tools", "build-toc.mjs")], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /build-toc: done/, `build-toc did nothing:\n${r.stdout}${r.stderr}`);
  } finally {
    writeFileSync(INDEX_MD, before[0], "utf8");
    writeFileSync(TOC_JSON, before[1], "utf8");
    rmSync(link, { force: true }); // the link itself, never the checkout it points at
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a CRLF checkout of the index is not drift", () => {
  withFileChanged(INDEX_MD, () => writeFileSync(INDEX_MD, readFileSync(INDEX_MD, "utf8").replace(/\n/g, "\r\n"), "utf8"), () => {
    assert.equal(check([]).code, 0);
  });
});
