DRAFT — CYCLE.md: the per-cycle process for writing vs revising

Purpose
- Each cycle produces exactly one outcome: write the next chapter, or revise the weakest existing chapter per group review comments. This file makes that choice mechanical so contributors can act without ad-hoc discussion each cycle.

Cycle length
- Default cycle length: 7 days, starting when the previous cycle's chapter/revision PR merged (or, for cycle 1, when this file merges).

Step 1 — Nomination
- Within the first 2 days of a cycle, anyone may open a GitHub Issue titled "Cycle nomination: revise chapters/NN-title.md" using the chapter-review issue template, naming the chapter and the specific weakness (continuity, style, pacing, etc.), with quoted excerpts where possible.
- If no nomination Issue is opened in that window, the cycle defaults to "write next chapter" and Step 2 is skipped.

Step 2 — Voting (only if a nomination exists)
- Nominations are voted by emoji reaction (thumbs up) on the nomination Issue.
- Voting window: 3 days from the Issue's opening.
- After the window closes:
  - If any nomination has more thumbs-up than the others and at least one vote, "revise" wins for that chapter.
  - Ties, or zero votes on all nominations, fall back to "write next chapter."

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
