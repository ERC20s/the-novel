DRAFT — chapters/00-template.md: chapter template and filename convention

Filename convention
- Use: chapters/NN-title.md where NN is the two-digit chapter number (01, 02, ...).
- This file is the TEMPLATE, not chapter 00. There is no chapter 00; the novel starts at chapters/01-<title>.md. Copy this file to a new NN-title.md and replace the example values — never write prose into 00-template.md.

Front-matter fields (plain text at top of the file)
- Filename: chapters/[NN-title].md
- Title: [Chapter Title]
- ChapterNumber: [NN]
- TargetWords: 2000-3000
- ContinuityNotes: [short notes on how this fits the outline and any deviations]
- FocalCharacter: [Name]

Example header (canon values — see STYLE.md and outline.md)
Filename: chapters/01-the-low-tide.md
Title: The Low Tide
ChapterNumber: 01
TargetWords: 2000-3000
ContinuityNotes: Act I opening image — Mara Voss on night dispatch in Amity Cove; status quo established, the missing-boat pattern hinted, no reveal
FocalCharacter: Mara Voss

- The Filename header is required and must name the file it sits in — either the bare basename (01-the-low-tide.md) or the repository path (chapters/01-the-low-tide.md). Any other value, or a missing Filename, is a check failure.
- The title in the header and the title in the filename must match (Title: The Low Tide -> 01-the-low-tide.md).
- FocalCharacter must be a name from the STYLE.md Cast (Mara Voss, Dez Okafor, Lena Voss, Colm Reyes, Thomas Ridge). Placeholder names such as "Protagonist Name" are a review failure.
- ChapterNumber must match a slot in the outline.md chapter mapping, and ContinuityNotes must say which beat it serves.

How the prose should read
- Do not invent a second sample here. Write to the Voice touchstone in STYLE.md (the section after Dialogue and Attribution): past tense, close third limited, plain attribution, concrete working detail, no omniscient commentary. Reviewers quote that passage; draft against it.
- The touchstone is an exemplar, not canon — match its distance and density, not its sentences or its events.

Checklist for contributors
- Filename follows NN-title.md and is placed in chapters/.
- Title, filename and ChapterNumber agree, and FocalCharacter is a named cast member from STYLE.md.
- Prose matches the STYLE.md Voice touchstone (past tense, close third limited, economical detail).
- Header includes Filename, Title, ChapterNumber, TargetWords, ContinuityNotes, and FocalCharacter.
- Filename in the header matches the file it is saved as.
- Chapter uses the STYLE.md defaults (past tense, close third-person limited unless marked).
- Keep target words between 2,000 and 3,000 unless the group decides otherwise; note deviations in ContinuityNotes.
- The file actually contains a chapter. A body of fewer than 50 words of prose (HTML comments, including the "Start writing the chapter below this line" marker the generator writes, do not count) is a check FAILURE, not a warning: the header being perfect is not the same as the chapter being written. Anything above that floor is advisory and reviewers keep the final say.
- Add short ContinuityNotes describing how the chapter advances the mapped beat(s) from outline.md.

Notes
- This is a DRAFT template to ease consistent submissions. Contributors are encouraged to edit these templates via normal proposals as the group develops preferences.