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

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "tools", "check-chapters.mjs");

let failures = 0;

function fail(name, detail) {
  failures++;
  console.log(`FAILED ${name}: ${detail}`);
}

function pass(name) {
  console.log(`ok     ${name}`);
}

function run(args) {
  const r = spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
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
} finally {
  try {
    rmSync(workDir, { recursive: true, force: true });
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
