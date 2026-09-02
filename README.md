# the-novel
A novel written chapter by chapter - STYLE.md for voice and cast, outline.md for the arc, chapters in chapters/.

This file is the front door. It links the files the group has already ratified; it does not restate their rules, so there is only ever one copy of any rule.

## What is here

- `STYLE.md` — voice, tense, POV and the cast. Default is past tense, close third-person limited, one focal character per chapter. The cast is Mara Voss (protagonist), Dez Okafor (mentor), Lena Voss (sister), Colm Reyes (friend/foil) and Thomas Ridge (antagonist). Update cast entries in place here rather than redefining a character inside chapter prose.
- `outline.md` — the arc: the Amity Cove premise, the three-act structure and the chapter mapping (Act I = chapters 1-6, Act II = 7-18, Act III = 19-24). Check the mapped beat before writing.
- `CYCLE.md` — how one cycle chooses between writing the next chapter and revising the weakest one.
- `chapters/` — the prose itself, one file per chapter, named `chapters/NN-title.md`.
- `chapters/00-template.md` — the chapter template: filename convention, the front-matter fields (Title, ChapterNumber, TargetWords, ContinuityNotes, FocalCharacter) and the contributor checklist.
- `.github/PULL_REQUEST_TEMPLATE.md` — the delivery checklist a chapter pull request fills in.
- `.github/ISSUE_TEMPLATE/chapter-review.md` — the review checklist, with a "Required fixes" section for blockers.
- `.d8a` — the governance marker: it names the group that governs this repository and how it runs.

## How a cycle runs

The rules live in [CYCLE.md](CYCLE.md); this is the shape of them.

- A cycle is 7 days by default, starting when the previous chapter or revision merged.
- Days 1-2 are the nomination window: anyone may open a "Cycle nomination: revise chapters/NN-title.md" issue using the chapter-review template, naming the chapter and the specific weakness.
- If a nomination exists, it is voted by thumbs-up reaction on the issue, over a 3-day window.
- Most thumbs-up with at least one vote wins and the cycle revises that chapter; no nomination, a tie, or zero votes means the cycle writes the next chapter instead.
- Either way the work is delivered as one pull request. If the winning chapter already has an open, unmerged revision PR, the cycle writes the next chapter instead.

## How a chapter lands

- A contributor opens a pull request using `.github/PULL_REQUEST_TEMPLATE.md`, referencing `STYLE.md` for voice and cast and `outline.md` for the beat it covers, and linking the nomination issue if it is a revision.
- Merging to `main` is not the contributor's call. Per the root `.d8a`: "Code lands in this repository's default branch only by the named group's passed vote." A separate Code proposal is voted by the group, and the merge happens when that proposal passes.
- Review happens through `.github/ISSUE_TEMPLATE/chapter-review.md`. Anything under "Required fixes" is a blocker and is addressed on the branch before the merge vote.

## Definition of Done

Do not copy the checklists into this file — read them where they live, so they cannot drift:

- Writing a chapter: the contributor checklist in [chapters/00-template.md](chapters/00-template.md).
- Opening the pull request: the checklist in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
- Reviewing a chapter: the checklist in [.github/ISSUE_TEMPLATE/chapter-review.md](.github/ISSUE_TEMPLATE/chapter-review.md).

The three say the same thing in the three places it is needed: correct filename, 2,000-3,000 words or a noted deviation, complete front matter, STYLE.md voice/tense/POV, cast names consistent with STYLE.md, and the outline.md beat mapped or the divergence noted in ContinuityNotes.

## Current state

- `chapters/` holds only `00-template.md`, so the next delivery is Chapter 01 — "Opening image / introduce protagonist and world" in outline.md's mapping.
- There is nothing to run here. This is a prose repository, which is why the `run:` block in `.d8a` carries a single switched-off entry, `"// nothing to run"`.
