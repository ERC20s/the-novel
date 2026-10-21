// editor-rules.mjs — the checks a human editor makes on a chapter, as pure functions.
//
// tools/check-chapters.mjs exits the process when it loads, so the rules it shares with
// the unit tests (tools/test-rules.mjs) live here instead: every export takes text in
// and returns data out, and nothing in this file touches the filesystem.
//
// As with the rest of tools/, the rules come from the repository, never from this file:
//   - Cast and Places, Banned phrases and Spelling exceptions are parsed from STYLE.md
//   - chapter slots and their optional "  - Title:" lines are parsed from outline.md
//   - the novel's default TargetWords range is parsed from chapters/00-template.md
//
// A finding is { rule, level, message }. level "error" always fails the run; "warn"
// fails only under --strict; "note" never fails anything. Every message starts with
// its rule id in brackets so a reviewer (or a test) can tell which rule fired.

// ---------------------------------------------------------------- parsing

// The cast, places, banned phrases and spelling exceptions, straight out of STYLE.md.
//   - Character: Mara Voss
//   - Place: Amity Cove
//   - Banned: little did she know — omniscient commentary   (text after " — " is the reason)
//   - Spelling exception: Boss
export function parseStyle(text) {
  const cast = [];
  const places = [];
  const banned = [];
  const exceptions = new Set();
  for (const line of String(text || "").split(/\r?\n/)) {
    let m = line.match(/^\s*-\s*Character:\s*(.+?)\s*$/i);
    if (m) {
      if (!cast.includes(m[1])) cast.push(m[1]);
      continue;
    }
    m = line.match(/^\s*-\s*Place:\s*(.+?)\s*$/i);
    if (m) {
      if (!places.includes(m[1])) places.push(m[1]);
      continue;
    }
    m = line.match(/^\s*-\s*Banned:\s*(.+?)\s*$/i);
    if (m) {
      const [phrase, ...why] = m[1].split(/\s+[—–]\s+/);
      const p = phrase.trim();
      if (p && !banned.some((b) => b.phrase.toLowerCase() === p.toLowerCase())) {
        banned.push({ phrase: p, reason: why.join(" — ").trim() || null });
      }
      continue;
    }
    m = line.match(/^\s*-\s*Spelling exception:\s*(.+?)\s*$/i);
    if (m) for (const w of m[1].split(/\s*,\s*/)) if (w) exceptions.add(w);
  }
  return { cast, places, banned, exceptions };
}

// The legal chapter slots, and any title the outline fixes for a single-chapter slot:
//   - Chapter 01: Opening image / introduce protagonist and world
//     - Title: The Low Tide
//   - Chapters 07-18: Development and complications
// A range line reserves its slots but can never carry a title.
export function parseOutline(text) {
  const slots = new Set();
  const titles = new Map();
  let current = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const range = line.match(/^\s*-\s*Chapters\s+(\d{1,3})\s*[-–]\s*(\d{1,3})\s*:/i);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let n = Math.min(from, to); n <= Math.max(from, to); n++) slots.add(n);
      current = null;
      continue;
    }
    const one = line.match(/^\s*-\s*Chapter\s+(\d{1,3})\s*:/i);
    if (one) {
      current = Number(one[1]);
      slots.add(current);
      continue;
    }
    const title = line.match(/^\s+-\s*Title:\s*(.+?)\s*$/i);
    if (title && current !== null) {
      if (!titles.has(current)) titles.set(current, title[1]);
      continue;
    }
    // any other top-level line ends the current chapter's sub-bullets
    if (/^\S/.test(line)) current = null;
  }
  return { slots, titles };
}

// The novel's default range: the first "TargetWords: N-M" in chapters/00-template.md.
export function parseSpecRange(templateText) {
  const m = String(templateText || "").match(/TargetWords:\s*(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  return low > 0 && low <= high ? { low, high } : null;
}

// ---------------------------------------------------------------- text helpers

// Replace a span with spaces but keep its newlines, so line numbers survive.
function blank(s) {
  return s.replace(/[^\n]/g, " ");
}

export function stripComments(text) {
  return String(text).replace(/<!--[\s\S]*?-->/g, blank);
}

// The inside of an emphasis span delimited by c: it may run over the hard line wraps of
// its paragraph (chapters are wrapped at ~80 columns), but never over a blank line.
const spanOf = (c) => `[^${c}\\n]+(?:\\n(?![ \\t]*\\n)[^${c}\\n]+)*`;
const STAR_SPAN = new RegExp(`\\*\\*${spanOf("*")}\\*\\*|\\*${spanOf("*")}\\*`, "g");
const UNDERSCORE_SPAN = new RegExp(`(^|[^\\p{L}\\p{N}_])_${spanOf("_")}_(?![\\p{L}\\p{N}_])`, "gu");

// Narration only: what the narrator says, not what a character says or thinks aloud.
// Removed (blanked): HTML comments, block-quoted lines, *italic* / _italic_ spans (the
// convention for direct thought, wrapped or not), and double-quoted dialogue. Within a
// paragraph a quote left open runs to the paragraph's end, which is how a speech that
// carries on into the next paragraph is punctuated.
export function narration(text) {
  let t = stripComments(text);
  t = t.replace(/^[ \t]*>.*$/gm, blank);
  t = t.replace(STAR_SPAN, blank);
  t = t.replace(UNDERSCORE_SPAN, (m, pre) => pre + blank(m.slice(pre.length)));
  return t
    .split(/(\n[ \t]*\n)/)
    .map((para) => {
      let out = "";
      let open = null; // the closing character we are waiting for, or null in narration
      for (const ch of para) {
        if (open === null) {
          if (ch === "“") open = "”";
          else if (ch === '"') open = '"';
          out += open === null ? ch : " ";
        } else {
          if (ch === open) open = null;
          out += ch === "\n" ? "\n" : " ";
        }
      }
      return out;
    })
    .join("");
}

function lineOf(text, index, offset) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") n++;
  return n + offset;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function linesList(lines) {
  const uniq = [...new Set(lines)];
  return uniq.length === 1 ? `line ${uniq[0]}` : `lines ${uniq.slice(0, 5).join(", ")}${uniq.length > 5 ? ", …" : ""}`;
}

// Optimal string alignment distance: Levenshtein plus adjacent transpositions, so
// "Rigde" is one edit from "Ridge".
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// How far a word may drift from a canonical name before it stops being a misspelling of
// it and starts being a different word.
function tolerance(word) {
  return word.length <= 5 ? 1 : 2;
}

// A misspelling keeps the name's first letter ("Marra", "Okafur", "Rigde"); requiring it
// keeps "Boss" from reading as "Voss" and "Bridge" from reading as "Ridge".
function nearMiss(word, name) {
  return word !== name && word[0].toLowerCase() === name[0].toLowerCase() && editDistance(word, name) <= tolerance(name);
}

// The closest canonical name to a typed one, for "did you mean" hints on headers.
export function closestName(typed, names) {
  let best = null;
  let bestD = Infinity;
  for (const n of names) {
    const dist = editDistance(String(typed).toLowerCase(), n.toLowerCase());
    if (dist < bestD) {
      best = n;
      bestD = dist;
    }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(best.length / 4)) ? best : null;
}

// ---------------------------------------------------------------- names and places

const CAP_WORD = /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}+(?![\p{L}\p{N}])/gu;

// Names spelled as in STYLE.md. Dialogue counts here: a misspelt name is misspelt
// whoever says it. Three passes, each reported once per distinct spelling:
//   1. a full name in the wrong case ("Amity cove")
//   2. a two-word name with one half off: a near-miss ("Mara Vass", "Amitty Cove") or a
//      crossed name ("Mara Okafor" — one character's first name, another's surname)
//   3. a capitalised word mid-sentence (so a proper noun) one or two letters from a
//      cast or place word, keeping its first letter ("Marra", "Okafur") — sentence-initial words are skipped,
//      because every sentence starts with a capital and "Calm" is not "Colm"
// A real, different name that trips pass 3 is listed in STYLE.md as a Spelling exception.
export function checkNames(body, style, offset = 0) {
  const text = stripComments(body);
  const entities = [...style.cast, ...style.places].map((n) => n.split(/\s+/));
  const canon = new Set(entities.flat());
  const surnames = new Set(entities.filter((e) => e.length > 1).map((e) => e[e.length - 1]));
  const found = new Map(); // key -> { rule, message, lines }
  const add = (rule, key, message, line) => {
    const f = found.get(key) || { rule, message, lines: [] };
    f.lines.push(line);
    found.set(key, f);
  };
  const flaggedAt = new Set(); // word indexes already reported, so pass 3 does not repeat them

  // 1. full names in the wrong case
  for (const parts of entities) {
    if (parts.length < 2) continue;
    const full = parts.join(" ");
    const re = new RegExp(`(?<![\\p{L}])${parts.map(escapeRe).join("\\s+")}(?![\\p{L}])`, "giu");
    for (const m of text.matchAll(re)) {
      const seen = m[0].replace(/\s+/g, " ");
      if (seen !== full) {
        add("name-spelling", `case:${seen}`, `"${seen}" should be written "${full}" as in STYLE.md`, lineOf(text, m.index, offset));
        flaggedAt.add(m.index);
      }
    }
  }

  // 2. two capitalised words in a row: check each against every two-word name
  const words = [...text.matchAll(CAP_WORD)].map((m) => ({ w: m[0], i: m.index }));
  for (let k = 0; k + 1 < words.length; k++) {
    const a = words[k];
    const b = words[k + 1];
    if (!/^\s+$/.test(text.slice(a.i + a.w.length, b.i))) continue;
    const pair = `${a.w} ${b.w}`;
    if (entities.some((e) => e.join(" ") === pair)) continue;
    for (const parts of entities) {
      if (parts.length !== 2) continue;
      const [first, last] = parts;
      const full = parts.join(" ");
      let rule = null;
      let message = null;
      if (a.w === first && b.w !== last) {
        if (nearMiss(b.w, last)) {
          rule = "name-spelling";
          message = `"${pair}" looks like a misspelling of "${full}" (STYLE.md)`;
        } else if (surnames.has(b.w)) {
          rule = "name-crossed";
          message = `"${pair}" crosses two names — STYLE.md has "${full}" and ${entities
            .filter((e) => e[e.length - 1] === b.w)
            .map((e) => `"${e.join(" ")}"`)
            .join(", ")}`;
        }
      } else if (b.w === last && a.w !== first && !canon.has(a.w) && nearMiss(a.w, first)) {
        rule = "name-spelling";
        message = `"${pair}" looks like a misspelling of "${full}" (STYLE.md)`;
      }
      if (rule) {
        add(rule, `pair:${pair}`, message, lineOf(text, a.i, offset));
        flaggedAt.add(a.i);
        flaggedAt.add(b.i);
        break;
      }
    }
  }

  // 3. lone mid-sentence capitalised words near a canonical one
  const canonWords = [...canon].filter((w) => w.length >= 4);
  for (const { w, i } of words) {
    if (flaggedAt.has(i) || w.length < 4 || canon.has(w) || style.exceptions.has(w)) continue;
    // Markdown emphasis is not punctuation, and a closing quote or bracket after a full
    // stop ends the sentence just as the stop does: “Say anything.” Calm ...
    const prev = text
      .slice(0, i)
      .replace(/[\s*_#>]+$/, "")
      .replace(/(?<=[.!?…])[”’")\]]+$/, "")
      .slice(-1);
    if (prev === "" || /[.!?…“"‘'(\[:—–-]/.test(prev)) continue; // sentence-initial
    const target = canonWords.find((c) => nearMiss(w, c));
    if (target) {
      add("name-spelling", `word:${w}`, `"${w}" looks like a misspelling of "${target}" (STYLE.md) — if it is a different name, add "- Spelling exception: ${w}" to STYLE.md`, lineOf(text, i, offset));
    }
  }

  return [...found.values()].map((f) => ({
    rule: f.rule,
    level: "warn",
    message: `[${f.rule}] ${f.message} (${linesList(f.lines)})`,
  }));
}

// ---------------------------------------------------------------- banned phrases

// Narration only — a character may say "whilst"; the narrator may not.
export function checkBanned(body, style, offset = 0) {
  const text = narration(body);
  const findings = [];
  for (const { phrase, reason } of style.banned) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${phrase.split(/\s+/).map(escapeRe).join("\\s+")}(?![\\p{L}\\p{N}])`, "giu");
    const lines = [...text.matchAll(re)].map((m) => lineOf(text, m.index, offset));
    if (lines.length) {
      findings.push({
        rule: "banned-phrase",
        level: "error",
        message: `[banned-phrase] "${phrase}" is on the STYLE.md banned list${reason ? ` (${reason})` : ""}: ${plural(lines.length, "use")}, ${linesList(lines)}`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- point of view

const FIRST_PERSON = /(?<![\p{L}\p{N}'’])(?:I|[Mm]e|[Mm]y|[Mm]ine|[Mm]yself|[Ww]e|[Uu]s|[Oo]ur|[Oo]urs|[Oo]urselves)(?![\p{L}\p{N}])/gu;
const INTERIOR = "thought|wondered|felt|knew|realized|realised|remembered|decided|wished|hoped|feared|worried|suspected|believed|sensed";
const HEDGE = /(?:^|\s)(?:if|whether|maybe|perhaps|probably|guessed|supposed|imagined)\s*$/i;

// What a reader calls a character by: the full name, the first name, and the surname
// when no one else in the cast shares it (two Vosses means "Voss" alone is ambiguous).
function callNames(name, cast) {
  const parts = name.split(/\s+/);
  const out = [name];
  if (parts.length > 1) {
    out.push(parts[0]);
    const last = parts[parts.length - 1];
    if (cast.filter((c) => c.split(/\s+/).pop() === last).length === 1) out.push(last);
  }
  return out;
}

// STYLE.md: close third limited, one focal character per chapter, and every fact on the
// page is something that character could notice. Three mechanical signs of a break:
//   pov-first-person  "I"/"we" in narration (dialogue and italic thought are exempt)
//   pov-head-hop      another cast member's interior stated as fact ("Dez knew ...");
//                     hedged guesses ("whether Dez knew") are not flagged
//   pov-focal-absent  the FocalCharacter is never named in the chapter at all
export function checkPov(body, focal, style, offset = 0) {
  const findings = [];
  const text = narration(body);

  const fp = [...text.matchAll(FIRST_PERSON)];
  if (fp.length) {
    const lines = fp.map((m) => lineOf(text, m.index, offset));
    findings.push({
      rule: "pov-first-person",
      level: "warn",
      message: `[pov-first-person] first-person narration outside dialogue ("${fp[0][0]}", ${plural(fp.length, "use")}, ${linesList(lines)}) — STYLE.md sets close third limited`,
    });
  }

  if (focal && style.cast.includes(focal)) {
    for (const other of style.cast) {
      if (other === focal) continue;
      const names = callNames(other, style.cast).map(escapeRe).join("|");
      const re = new RegExp(`(?<![\\p{L}])(${names})(?:['’]s\\s+(?:thoughts|mind)|\\s+(?:${INTERIOR}))(?![\\p{L}])`, "gu");
      const hits = [...text.matchAll(re)].filter((m) => !HEDGE.test(text.slice(Math.max(0, m.index - 20), m.index)));
      if (hits.length) {
        findings.push({
          rule: "pov-head-hop",
          level: "warn",
          message: `[pov-head-hop] "${hits[0][0].replace(/\s+/g, " ")}" states ${other}'s interior in a ${focal} chapter (${linesList(hits.map((m) => lineOf(text, m.index, offset)))}) — show only what ${focal} can notice`,
        });
      }
    }

    const all = stripComments(body);
    const named = callNames(focal, style.cast).some((n) => new RegExp(`(?<![\\p{L}])${escapeRe(n)}(?![\\p{L}])`, "u").test(all));
    if (!named) {
      findings.push({
        rule: "pov-focal-absent",
        level: "warn",
        message: `[pov-focal-absent] FocalCharacter ${focal} is never named in the chapter — the reader cannot tell whose point of view this is`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- word count vs spec

// ContinuityNotes is where the template says a deviation goes; "Deviation:" marks one.
export function notesDeviation(continuityNotes) {
  return /\bdeviation:/i.test(String(continuityNotes || ""));
}

export function checkSpecRange(targetLow, targetHigh, spec) {
  if (!spec || targetLow === null || targetHigh === null) return [];
  if (targetLow >= spec.low && targetHigh <= spec.high) return [];
  const fmt = (n) => n.toLocaleString("en-US");
  return [
    {
      rule: "words-spec",
      level: "warn",
      message: `[words-spec] TargetWords ${targetLow}-${targetHigh} is not within the spec's ${fmt(spec.low)}-${fmt(spec.high)} (chapters/00-template.md) — record the group's decision as "Deviation: ..." in ContinuityNotes`,
    },
  ];
}

// ---------------------------------------------------------------- the outline

// chapters: [{ file, number, title }] for every scanned chapter with a numeric
// ChapterNumber. Returns per-file findings plus findings about the outline itself:
//   outline-title    the outline fixes a title for this slot and the header disagrees
//   outline-gap      a slot is empty although a later slot has a chapter — chapters are
//                    written in outline order (CYCLE.md: the next unused number)
//   outline-unwritten  the trailing slots nobody has reached yet: a note, never a failure,
//                    so the strict gate can pass on a novel that is still being written
// A ChapterNumber outside every slot is already an error in check-chapters.mjs.
export function checkOutline(chapters, outline) {
  const perFile = new Map();
  const findings = [];
  const norm = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

  for (const ch of chapters) {
    const want = outline.titles.get(ch.number);
    if (want !== undefined && ch.title && norm(ch.title) !== norm(want)) {
      const list = perFile.get(ch.file) || [];
      list.push({
        rule: "outline-title",
        level: "error",
        message: `[outline-title] Title "${ch.title}" does not match outline.md, which names chapter ${String(ch.number).padStart(2, "0")} "${want}"`,
      });
      perFile.set(ch.file, list);
    }
  }

  const slots = [...outline.slots].sort((a, b) => a - b);
  const written = new Set(chapters.map((c) => c.number));
  const lastWritten = slots.filter((s) => written.has(s)).pop();
  const pad = (n) => String(n).padStart(2, "0");
  const gaps = lastWritten === undefined ? [] : slots.filter((s) => s < lastWritten && !written.has(s));
  for (const s of gaps) {
    findings.push({
      rule: "outline-gap",
      level: "warn",
      message: `[outline-gap] slot ${pad(s)} has no chapter file but chapter ${pad(lastWritten)} does — chapters are written in outline order`,
    });
  }
  const unwritten = slots.filter((s) => (lastWritten === undefined || s > lastWritten) && !written.has(s));
  if (unwritten.length) {
    const span = unwritten.length === 1 ? `slot ${pad(unwritten[0])}` : `slots ${pad(unwritten[0])}-${pad(unwritten[unwritten.length - 1])}`;
    findings.push({
      rule: "outline-unwritten",
      level: "note",
      message: `[outline-unwritten] ${span} not written yet (${plural(unwritten.length, "slot")}); next is ${pad(unwritten[0])}`,
    });
  }
  return { perFile, findings };
}

// ---------------------------------------------------------------- suppressions

// A chapter may waive a WARNING rule it has been reviewed against, in an HTML comment
// that the word count already ignores:  <!-- check-chapters: allow pov-head-hop -->
// Errors cannot be waived this way; amend STYLE.md or outline.md instead.
export function allowedRules(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/<!--\s*check-chapters:\s*allow\s+([^>]*?)\s*-->/gi)) {
    for (const r of m[1].split(/[\s,]+/)) if (r) out.add(r);
  }
  return out;
}
