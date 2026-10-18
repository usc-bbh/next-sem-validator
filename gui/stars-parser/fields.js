// Stage 5 — fields(blocks) → the parsed report. See STARS_PARSER_DESIGN.md §7.
//
// Reads course rows by column, collects the course list from the two blocks
// that are the student's record, classifies transfer credit by what each row
// is, and reads the header fields. Nothing here decides whether the result is
// trustworthy; stage 6 (checks.js) does that.

import { COURSE_ROW } from "./blocks.js";

// ---- course rows -------------------------------------------------------------

// Column offsets within a course row, relative to the column where its term
// starts (6 on every sample). Calibrated on all 12 samples:
//
//   20243 BUAD312    G  4.0 Lp    Statistics and Data Science f
//   20251 IR  101   XGW 4.0 Lp    International Relations
//   20262 BUAD302       4.0 RG >IPCommunication Strategy in Bus
//   99993 TRNSFR WORK  28.0 TR    Total Transfer Units
//   |     |        |   |    |  |  |
//   0     6        15  19   24 27 30
//
// The code takes up to 9 columns. Each suffix letter has a column of its own
// (L, X, G, then W / P / M), the fourth sharing a column with a two-digit
// unit count's tens digit. Codes longer than 9 characters only appear on
// transfer rows, which carry no suffixes, so a code that runs past column 15
// is read to its end.
const COL = { code: 6, suffix: 15, units: 19, grade: 24, flags: 27, title: 30 };

// The term code that marks the TRNSFR WORK summary line, not a course.
export const TRANSFER_TOTAL_TERM = "99993";

// Parses one course row. Returns null if the line isn't a well-formed row.
export function parseRow(line) {
  const m = line.match(/^( *)(\d{5}) /);
  if (!m || !COURSE_ROW.test(line)) return null;
  const t = m[1].length;
  const col = (name) => t + COL[name];
  const slice = (from, to) => line.slice(col(from), to === undefined ? undefined : col(to));

  let rawCode = slice("code", "suffix").trimEnd();
  let suffixArea = slice("suffix", "units");
  const pastCode = line[col("suffix")];
  if (rawCode.length === 9 && pastCode && pastCode !== " ") {
    const rest = line.slice(col("suffix")).match(/^\S+/)[0];
    rawCode += rest;
    suffixArea = line.slice(col("suffix") + rest.length, col("units"));
  }

  const unitsText = slice("units", "grade");
  if (!/^ *\d+\.\d $/.test(unitsText)) return null;
  if (line[col("grade") + 2] !== undefined && line[col("grade") + 2] !== " ") return null;

  const grade = line.slice(col("grade"), col("grade") + 2).trim();
  const slot = slice("flags", "title");
  const flags = slot.startsWith(">") ? [slot.trim()] : [];

  return {
    term: m[2],
    rawCode,
    code: normalizeCode(rawCode),
    suffixes: [...suffixArea].filter((c) => c !== " "),
    units: Number(unitsText),
    grade,
    flags,
    title: (flags.length ? slice("title") : slice("flags")).trim(),
  };
}

// "BUAD312" → "BUAD 312", "IR  101" → "IR 101", "CHEM105A" → "CHEM 105A",
// matching the validator's _normalize_code. Any other shape (AP34:COMP,
// TR-COMP-2, HIS/AMERIC) is passed through unchanged.
export function normalizeCode(raw) {
  const m = raw.trim().match(/^([A-Z]{2,4}) *(\d{3}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : raw.trim();
}

// ---- status, pass rule, source ----------------------------------------------

// Doc 02 §7's stopgap pass rule: any grade other than these is passed. Lf and
// Pn are STARSRedacter's tokens for a failed letter grade and a no-pass. IX
// and NS earn no units until resolved, so they count as not passed too.
const NOT_PASSED_GRADES = new Set(["F", "NP", "NC", "IN", "IX", "MG", "NS", "W", "Lf", "Pn"]);

// Flags whose credit is deleted. The row stays on the record, but it doesn't
// count as passing the course.
const CREDIT_DELETED_FLAGS = new Set([">D", ">Z", ">FF", ">OS"]);

const REDACTION_TOKENS = new Set(["Lp", "Lf", "Pp", "Pn"]);

export function isInProgress(row) {
  return row.grade === "RG" || row.flags.includes(">IP");
}

// true or false for a completed row; null for one in progress, which hasn't
// been decided yet.
export function passed(row) {
  if (isInProgress(row)) return null;
  if (NOT_PASSED_GRADES.has(row.grade)) return false;
  return !row.flags.some((flag) => CREDIT_DELETED_FLAGS.has(flag));
}

// What the row is, which decides whether it can satisfy a USC prerequisite
// (§7, "Transfer credit — revised model"). The TR grade alone can't tell an
// exam from another school's course, and CMPR120 or ANTH101 look exactly
// like USC codes but are the sending school's own.
export function sourceOf(row) {
  if (row.grade !== "TR") return "usc";
  if (/^AP\d+:/.test(row.rawCode) || /^DIPLOMA\+/.test(row.rawCode) || /^IBTEST:/.test(row.title)) {
    return "exam";
  }
  if (/^TR-/.test(row.rawCode)) return "transfer_generic";
  return "transfer";
}

function toCourse(row) {
  return {
    term: row.term,
    code: row.code,
    rawCode: row.rawCode,
    title: row.title,
    units: row.units,
    grade: row.grade,
    suffixes: row.suffixes,
    flags: row.flags,
    source: sourceOf(row),
    passed: passed(row),
    origin: "parsed",
  };
}

// ---- reading blocks ----------------------------------------------------------

const rowsOf = (block) => block.lines.map(parseRow).filter(Boolean);
const find = (bs, label) => bs.find((b) => b.label === label);
const inBlock = (block, re) => {
  for (const line of block?.lines ?? []) {
    const m = line.match(re);
    if (m) return m;
  }
  return null;
};

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to"]);

// "ARTIFICIAL INTELLIGENCE FOR BUSINESS" → "Artificial Intelligence for Business"
export function titleCase(text) {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.replace(/^./, (c) => c.toUpperCase())))
    .join(" ");
}

const DEGREE_ABBREVIATIONS = { "BACHELOR OF SCIENCE": "BS", "BACHELOR OF ARTS": "BA" };

function readHeader(header) {
  const lines = header.lines.map((line) => line.trim());
  const title = lines.indexOf("STARS - DEGREE PROGRESS REPORT");
  const degreeLine = title >= 0 ? lines[title + 1] ?? "" : "";
  const majorLine = title >= 0 ? lines[title + 2] ?? "" : "";
  return {
    prepared: inBlock(header, /^PREPARED: (\S+)/)?.[1] ?? null,
    programCode: inBlock(header, /^PROGRAM: (\S+)/)?.[1] ?? null,
    catalogYear: inBlock(header, /CATALOG YEAR: (\d{5})/)?.[1] ?? null,
    degreeName: degreeLine,
    degree: DEGREE_ABBREVIATIONS[degreeLine.toUpperCase()] ?? null,
    major: majorLine ? titleCase(majorLine) : null,
  };
}

function readPosts(pertinent) {
  const posts = [];
  let inPosts = false;
  for (const line of pertinent.lines) {
    if (/^CURRENT POST:/.test(line)) {
      inPosts = true;
      continue;
    }
    const m = line.match(/^ +(\d{1,5}) +([A-Z]{2,4}) +([A-Z]{2,5}) +([A-Z]{2,5}) +(\d{5})$/);
    if (inPosts && m) {
      posts.push({ program: m[1], degree: m[2], major: m[3], school: m[4], term: m[5] });
    } else if (inPosts) {
      inPosts = false;
    }
  }
  return posts;
}

function readMinors(pertinent, bs) {
  const minors = [];
  for (const line of pertinent.lines) {
    const m = line.match(/^MINOR: +(.+?)(?: +(\d{5}))?$/);
    if (!m || /^No minor declared$/i.test(m[1])) continue;
    const name = m[1];
    const block = bs.find(
      (b) => b.label === "minor" && b.heading.toUpperCase().includes(`MINOR REQUIREMENTS FOR ${name.toUpperCase()}`)
    );
    minors.push({
      name,
      effectiveTerm: m[2] ?? null,
      // The sentence can wrap: "(MINOR CATALOG YEAR" / "IS PROCESSED AS 20251)".
      catalogYear: block?.lines.join(" ").match(/MINOR CATALOG YEAR\s+IS PROCESSED AS (\d{5})/)?.[1] ?? null,
    });
  }
  return minors;
}

// A redacted GPA (STARSRedacter prints X.XXX, or x.xxx on one sample) and a
// missing one both come back null.
function readGpa(bs) {
  const block = bs.find((b) => b.label === "gpa" && /OF ALL USC BACCALAUREATE UNITS/.test(b.heading));
  const m = inBlock(block, /^ *EARNED: +(\d\.\d{3}) GPA/);
  return m ? Number(m[1]) : null;
}

function readUnits(unitTotal) {
  const number = (re) => {
    const m = inBlock(unitTotal, re);
    return m ? Number(m[1]) : null;
  };
  return {
    required: Number(unitTotal.heading.match(/MINIMUM OF (\d+) UNITS/)[1]),
    // Three-digit totals fill the gap: "EARNED:103.00 UNITS".
    earned: number(/^ *EARNED: *(\d+\.\d+) UNITS/),
    inProgress: number(/^ *IN-PROCESS: *(\d+\.\d+) UNITS/) ?? 0,
  };
}

// NOTE: RE - SUB CMPR120 FOR CSCI113 → { from: "CMPR 120", to: "CSCI 113" }
function readEquivalents(bs) {
  const out = [];
  for (const b of bs) {
    for (const line of b.lines) {
      const m = line.match(/\bRE - SUB (.+?) FOR (.+?)\s*$/);
      if (m) out.push({ from: normalizeCode(m[1]), to: normalizeCode(m[2]) });
    }
  }
  return dedupe(out, (e) => `${e.from}|${e.to}`);
}

// NOTE: CW - COURSE WAIVED DSCI281 → "DSCI 281"
function readWaivers(bs) {
  const out = [];
  for (const b of bs) {
    for (const line of b.lines) {
      const m = line.match(/\bCW - COURSE WAIVED (.+?)\s*$/);
      if (m) out.push(normalizeCode(m[1]));
    }
  }
  return dedupe(out, (code) => code);
}

function dedupe(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- the course list ---------------------------------------------------------

// Course rows come from the master list (unitTotal) and "other courses",
// which are the student's record. Transfer rows also come from every block
// that repeats rows, because a transfer applied to a requirement is listed
// only there (AP31:COMP in the CS core, CMPR120 in AI for Business). Rows are
// de-duplicated by (term, code).
export function collectCourses(bs) {
  const rows = [];
  for (const b of bs) {
    if (b.courses === "record") rows.push(...rowsOf(b));
    else if (b.courses === "repeat") rows.push(...rowsOf(b).filter((row) => row.grade === "TR"));
  }
  const unique = dedupe(
    rows.filter((row) => row.term !== TRANSFER_TOTAL_TERM),
    (row) => `${row.term}|${row.rawCode}`
  );
  // Stable sort: report order within a term.
  return unique.sort((a, b) => a.term.localeCompare(b.term)).map(toCourse);
}

export function fields(bs) {
  const header = readHeader(find(bs, "header"));
  const pertinent = find(bs, "pertinentData");
  const unitTotal = find(bs, "unitTotal");

  const transferRow = rowsOf(unitTotal).find((row) => row.term === TRANSFER_TOTAL_TERM);
  const courses = collectCourses(bs);
  const redacted =
    courses.some((c) => REDACTION_TOKENS.has(c.grade)) ||
    bs.some((b) => b.lines.some((line) => /\bX\.XXX\b/i.test(line)));

  return {
    meta: {
      prepared: header.prepared,
      programCode: header.programCode,
      catalogYear: header.catalogYear,
      redacted,
      warnings: [],
    },
    degree: header.degree,
    major: header.major,
    classLevel: inBlock(pertinent, /Current Class Level (\w+)/)?.[1] ?? null,
    entryTerm: inBlock(pertinent, /Term of USC Entrance (\d{5})/)?.[1] ?? null,
    expectedGraduation: inBlock(pertinent, /USC Expected Graduation Date - (.+?)\s*$/)?.[1] ?? null,
    gpa: readGpa(bs),
    posts: readPosts(pertinent),
    minors: readMinors(pertinent, bs),
    units: { ...readUnits(unitTotal), transferTotal: transferRow ? transferRow.units : 0 },
    completedCourses: courses.filter((c) => c.passed !== null),
    inProgressCourses: courses.filter((c) => c.passed === null),
    equivalents: readEquivalents(bs),
    waivedCourses: readWaivers(bs),
  };
}
