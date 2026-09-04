Filename: 04-broken-stub.md
Title: Broken Stub
ChapterNumber: 04
TargetWords: 2000-3000
ContinuityNotes: FIXTURE ONLY — not a chapter, not canon, and it reserves no slot. A perfect header with an empty body; the checker must flag it as a stub.
FocalCharacter: Mara Voss

<!--
  FIXTURE ONLY, and deliberately empty. Everything the checker can test in a header is
  correct here: the name matches the file, the title slugs to the filename slug, the
  number matches the filename and sits in an outline.md slot, the focal character is a
  STYLE.md cast member, and no bracket placeholder is left behind.

  What is missing is the chapter. This is exactly what tools/new-chapter.mjs leaves on
  disk once a writer fills the two placeholders in and writes nothing else, and it used
  to exit 0 and print "ok". The only body here is this HTML comment, which the checker
  strips before counting words, so the file counts as zero words and must be reported
  as a stub.

  "broken" in the filename means npm test's --expect-fail self-test REQUIRES this file
  to be flagged. Nothing in tools/fixtures/ is part of the novel.
-->
