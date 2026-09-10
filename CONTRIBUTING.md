CONTRIBUTING — how to contribute chapters and avoid common reviewer rejections

Quick start
- Clone the repo and run the checks before you open a PR:
  - npm run new "NN" "Chapter Title"  # uses tools/new-chapter.mjs to scaffold a chapter
  - npm run check                      # run the chapter checker (basic mode)
  - npm run check:strict               # stricter checks (useful before review)
  - npm run toc                        # rebuild chapters/INDEX.md and toc.json
  - npm test                           # run fixtures and CLI tests
  - npm run check:report               # write a machine-readable report to tools/validation/REPORT.json

Where to start writing
- Copy chapters/00-template.md to chapters/NN-your-title.md and replace the header values and ContinuityNotes. Never write prose into 00-template.md itself.
- Read STYLE.md (voice, tense, POV, Cast) and outline.md (chapter slots and mapped beats) before you start.

Generator tips
- The generator accepts: node tools/new-chapter.mjs NN "Chapter Title" [--focal="Name"] [--dir=PATH] [--force]
- Example: npm run new -- 03 "Night Dispatch" --focal="Mara Voss" --dir=chapters
- Use --force only if you mean to override the check that prevents creating a second file for the same NN slot.

Common failures and how to fix them
- Filename header: the header line "Filename:" must name the file it sits in, either bare (01-the-low-tide.md) or full (chapters/01-the-low-tide.md). If it does not match the saved path the checker fails.
- Title and filename must match: Title: The Low Tide -> 01-the-low-tide.md.
- TargetWords: must be a numeric range like 2000-3000. The checker enforces this format.
- Stub floor: a chapter file with under 50 words of prose is a FAILURE (the header alone is not enough). Write at least 50 words of real prose before requesting review.
- Merge conflict markers (<<<<, >>>>, =====) fail the checker. Resolve all conflicts before committing.

Checks and CI
- Run npm run check locally before a PR. Run npm test to run fixtures and CLI tests.
- If you need a machine-readable report for a review, run npm run check:report; the checker will write tools/validation/REPORT.json.

Why this matters
- Following this checklist reduces predictable review delays caused by header, filename, word-count and conflict errors. It also helps reviewers focus on craft instead of formatting.

If this passes, a contributor will open a pull request that adds CONTRIBUTING.md at the repository root for the group's review; a separate Code proposal will then merge it.