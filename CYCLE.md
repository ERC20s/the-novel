DRAFT — CYCLE.md: the per-cycle process for writing vs revising

Purpose
- Each cycle produces exactly one outcome: write the next chapter, or revise the weakest existing chapter per group review comments. This file makes that choice mechanical so contributors can act without ad-hoc discussion each cycle.

Cycle length
- Default cycle length: 7 days, starting when the previous cycle's chapter/revision PR merged (or, for cycle 1, when this file merges).

Step 1 — Nomination
- Within the first 2 days of a cycle, anyone may open a GitHub Issue using the cycle-nomination issue template (.github/ISSUE_TEMPLATE/cycle-nomination.md), which supplies the title "Cycle nomination: revise chapters/NN-title.md" and the "nomination" label. Fill in the chapter file, the specific weakness (continuity, style, cast, pacing, clarity) and quoted excerpts where possible. Leave the title prefix intact; only replace NN-title.
- Open nominations for a cycle are the Issues carrying the "nomination" label; where that label is not yet in use in this repository, the "Cycle nomination:" title prefix identifies the same set. The chapter-review template is NOT used for nominations — it files reviews.
- If no nomination Issue is opened in that window, the cycle defaults to "write next chapter" and Step 2 is skipped.

Step 2 — Voting (only if a nomination exists)
- Nominations are voted by emoji reaction (thumbs up) on the nomination Issue.
- Voting window: from each nomination's opening until the END OF DAY 5 OF THE CYCLE. The close is the same moment for every nomination, whichever day it was opened, so all nominations are compared at one instant. (A nomination opened on day 2 therefore has a shorter window than one opened on day 1; that is intended, so Step 3 always has two full days.)
- At the close, count the thumbs-up on every nomination Issue of this cycle — that is, every Issue in the set defined in Step 1 (label "nomination", or the "Cycle nomination:" title prefix) opened within the first 2 days of this cycle and not closed by its author:
  - If one nomination has strictly more thumbs-up than every other and at least one vote, "revise" wins for that chapter.
  - Ties for the lead, or zero votes on all nominations, fall back to "write next chapter."
- The counter records the count in a comment on each nomination Issue, so the result can be checked after the fact.

Step 3 — Delivery
- The chosen work (new chapter or revision) is delivered as a pull request:
  - New chapter: adds chapters/NN-title.md following chapters/00-template.md, sized 2,000-3,000 words, using the next unused chapter number per outline.md's chapter mapping.
  - Revision: edits the nominated chapters/NN-title.md, addressing the Required fixes from the linked review Issue.
- The PR uses .github/PULL_REQUEST_TEMPLATE.md, references STYLE.md (voice, tense, POV, cast) and outline.md (Act/beat continuity), and links the nomination Issue if this is a revision.
- A contributor opens this pull request; merging it requires a separate Code proposal voted on by the group, per the existing governance workflow.

Fallback and edge cases
- If the winning nomination's chapter is already the subject of an open, unmerged revision PR, treat the cycle as "write next chapter" instead, to avoid duplicate work.
- If outline.md's chapter mapping is exhausted with no further placeholders, the group settles the next step by ordinary governance proposal rather than this file.

Notes
- This is a DRAFT process. Keep it short and amend it by proposal as the group learns what works.
