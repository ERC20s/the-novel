Filename: 06-broken-targetwords.md
Title: Broken TargetWords
ChapterNumber: 06
TargetWords: two thousand to three thousand
ContinuityNotes: FIXTURE ONLY — not a chapter, not canon; exercises TargetWords parsing
FocalCharacter: Mara Voss

This fixture is a test for the TargetWords header validation. Its header is otherwise
correct: the Filename names this file, the Title slugs to the filename, ChapterNumber is
in the outline slot and FocalCharacter is a cast name. The only problem is the
TargetWords line which uses free-form text rather than a numeric range. The body has
more than fifty words so the file would not be a stub; the checker must fail this file
because of the malformed TargetWords value and report a clear message about it.

Nothing in tools/fixtures/ is part of the novel.
