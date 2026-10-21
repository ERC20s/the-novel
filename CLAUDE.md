# CLAUDE.md

A novel written chapter by chapter: STYLE.md holds voice and cast, outline.md the 24-slot arc, chapters/ the prose.
The only code is the Node tooling in tools/ that checks chapter headers, word floors, slots and the TOC — there is no app to launch.

## Commands (Node >= 18, no runtime dependencies)

- Install: `npm ci`
- Check: `npm run check` (warnings for empty outline slots are expected until chapters exist)
- Test: `npm test` (runs `npm run toc` first, then the fixture self-test and `tools/test-cli.mjs`)
- Report: `npm run check:report` (writes tools/validation/REPORT.json)
- Strict: `npm run check:strict` — fails until every outline slot has a chapter; it is a pre-review gate, not part of CI
- Other: `npm run toc`, `npm run slots`, `npm run new -- NN "Title" [--focal="Name"]`

CI (.github/workflows/ci.yml) runs `npm ci`, `npm run check`, `npm test`, `npm run check:report` on every push and PR.
Generated files (chapters/INDEX.md, tools/validation/toc.json, tools/validation/REPORT.json) are not committed.

## Ground rules

- Work on a new branch from `main`; open one PR listing the commands run and their results before and after.
- Never modify `.d8a` or `.d8a-governance`. Never modify the group-store widget (`id="group-store"`, `groupStoreVerify`) copied from `.d8a`'s `payments:` block.
- Ignore open PRs by `d8a[bot]`: do not merge, close, rebase, cherry-pick from, or comment on them.
- Do not add a LICENSE file or licence text.
- Install and run the project's checks before and after changes; never report a result you did not get by running it.
- Fix root causes; never delete or weaken a test. New tests must be able to fail (no tautologies, no catch-all error handling, import every symbol used). If a test is wrong, fix it to test real behaviour and say so.
- Nothing dev-only in browser-shipped code (no localhost/private hosts, no debug fallbacks). No secrets, tokens or keys.
- CI runs exactly the declared checks and must fail when one fails: no `continue-on-error`, no `|| true`, no skipped jobs counted as passing. Pin Actions to current majors.
- Keep changes focused: no reformatting untouched files, no unneeded dependency upgrades, no renaming public files/URLs, no history rewrites.
