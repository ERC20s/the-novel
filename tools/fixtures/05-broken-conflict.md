Filename: 05-broken-conflict.md
Title: Broken Conflict
ChapterNumber: 05
TargetWords: 2000-3000
ContinuityNotes: FIXTURE ONLY — deliberately contains a merge conflict marker in the body so the checker flags it.
FocalCharacter: Mara Voss

This fixture is not a chapter; it exists only to exercise the checker's rule that
files containing Git merge conflict markers must be rejected.

<<<<<<< HEAD
Conflict left in the body.
=======
Other branch's text.
>>>>>>> feature/branch

Nothing in tools/fixtures/ is part of the novel.
