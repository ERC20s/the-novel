Title: A Title That Does Not Match The Filename
ChapterNumber: 3
TargetWords: 2000-3000
FocalCharacter: [Name]

This file is a test fixture for tools/check-chapters.mjs. It is the deliberately
broken sample and it must be flagged. Every rule it breaks is one the group already
wrote down:

- the Title slugs to "a-title-that-does-not-match-the-filename", not "broken-header"
  (chapters/00-template.md: the title in the header and the title in the filename must match)
- ChapterNumber 3 does not match the filename number 02
- ContinuityNotes is missing entirely
- FocalCharacter is the template placeholder [Name], not a STYLE.md Cast member

Nothing in tools/fixtures/ is part of the novel.
