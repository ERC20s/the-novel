chapters/00-template.md: chapter template, filename convention, and the Definition of Done

Filename convention
- Use: chapters/NN-title.md where NN is the two-digit chapter number (01, 02, ...).
- The title in the filename is the slug of the Title field (lowercase, hyphens): "The Low Tide" -> 01-the-low-tide.md.

Front-matter fields (plain text at top of the file)
- Title: [Chapter Title]
- ChapterNumber: [NN]
- TargetWords: 2000-3000
- ContinuityNotes: [which outline.md slot this fills, any deviation, and every new person, boat or place named in the chapter]
- FocalCharacter: [Name, spelled as in STYLE.md]

Example header (canon: Amity Cove, chapter 01 per outline.md's chapter mapping)
Title: The Low Tide
ChapterNumber: 01
TargetWords: 2000-3000
ContinuityNotes: Fills outline.md Chapter 01 — opening image, introduce protagonist and world. Establishes Mara Voss on night dispatch under Dez Okafor in Amity Cove; the missing boats are rumour only at this stage. No new named people, boats or places beyond STYLE.md and outline.md.
FocalCharacter: Mara Voss

Sample prose
- None. This template deliberately ships no example paragraph: invented prose here has read as canon before and started drafts off-voice. For voice, tense and distance, read STYLE.md; for the chapter's job, read the chapter mapping in outline.md.

Definition of Done (all six items, in order, for every chapter)
1. Header complete: Title, ChapterNumber, TargetWords, ContinuityNotes and FocalCharacter are all filled in, and the file is named chapters/NN-title.md.
2. The chapter number and the beat it covers match outline.md's chapter mapping; any divergence from that slot is stated in ContinuityNotes.
3. The chapter is 2,000-3,000 words of finished prose; a word count outside that range is stated and justified in ContinuityNotes.
4. Past tense and close third-person limited on a single focal character, per STYLE.md, unless the departure is flagged in ContinuityNotes.
5. Every cast name is spelled exactly as in STYLE.md (Mara Voss, Dez Okafor, Lena Voss, Colm Reyes, Thomas Ridge).
6. Any new person, boat or place named in the chapter is also named in ContinuityNotes, so the cast and setting files can be updated in step.

How this list is used
- These six items are the whole contributor contract. The same numbered list appears verbatim in .github/PULL_REQUEST_TEMPLATE.md and .github/ISSUE_TEMPLATE/chapter-review.md.
- A review that blocks a merge should name the failing item by number. An objection that is not one of these six is feedback, not a blocker; if the group wants it to block, it becomes item 7 by proposal.
- It is a floor, not a measure of quality. Passing all six does not oblige anyone to vote for a chapter.

Notes
- Change this list only by proposal, and change all three files in the same pull request so they stay identical.
