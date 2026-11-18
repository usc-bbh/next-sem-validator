// Stage 6 — check, and fail loudly. See STARS_PARSER_DESIGN.md §9.
//
// Hard checks throw StarsParseError naming the check, so the parser never
// returns a partial result. Warnings go into meta.warnings and the parse
// still succeeds: they cover things the validator doesn't depend on, so a
// surprising but readable report doesn't lock a student out.

import { COURSE_ROW } from "./blocks.js";
import { parseRow, isInProgress, sourceOf, TRANSFER_TOTAL_TERM, IN_PROCESS } from "./fields.js";

export class StarsParseError extends Error {
  // `check` is a short id: "notStars", "graduate", "landmarks",
  // "masterListRows", "unitsEarned", "uncollectedRows".
  constructor(check, message) {
    super(message);
    this.name = "StarsParseError";
    this.check = check;
  }
}

const sum = (values) => values.reduce((a, b) => a + b, 0);
const same = (a, b) => Math.abs(a - b) < 0.005;

// Class level by units earned, from doc 01.
export function classLevelFor(units) {
  if (units < 32) return "Freshman";
  if (units < 64) return "Sophomore";
  if (units < 96) return "Junior";
  return "Senior";
}

// Graduate reports have a different layout and different requirement types,
// and the validator is undergraduate-only, so they're refused up front with
// a message of their own (§3).
export function refuseGraduate(bs) {
  const header = bs.find((b) => b.label === "header");
  const degreeLine = header?.lines.map((l) => l.trim()).find((t) => /^(?:MASTER|DOCTOR) OF /i.test(t));
  if (bs.some((b) => b.label === "graduateData") || degreeLine) {
    throw new StarsParseError(
      "graduate",
      "This is a graduate STARS report. RegCheck only handles undergraduate reports."
    );
  }
}

// Check 1: the blocks everything downstream relies on.
function checkLandmarks(bs) {
  const count = (label) => bs.filter((b) => b.label === label).length;
  const missing = ["header", "pertinentData", "unitTotal", "legend"].filter((label) => count(label) === 0);
  if (missing.length) {
    throw new StarsParseError("landmarks", `Couldn't find these parts of the report: ${missing.join(", ")}.`);
  }
  if (count("unitTotal") > 1) {
    throw new StarsParseError("landmarks", "Found more than one unit-total block.");
  }
  const pertinent = bs.find((b) => b.label === "pertinentData");
  if (!pertinent.lines.some((line) => /^CURRENT POST:/.test(line))) {
    throw new StarsParseError("landmarks", "Couldn't find the CURRENT POST line.");
  }
}

// Check 2: every term-led line in the master list became a row.
function checkMasterListRows(unitTotal) {
  const lines = unitTotal.lines.filter((line) => COURSE_ROW.test(line));
  const unread = lines.filter((line) => !parseRow(line));
  if (unread.length) {
    throw new StarsParseError(
      "masterListRows",
      `Couldn't read ${unread.length} of ${lines.length} rows in the course list, starting with: ${unread[0].trim()}`
    );
  }
}

// Check 3: completed USC rows in the master list, plus TRNSFR WORK, equal
// EARNED. Held exactly on all 11 samples; it's what proves the list is whole.
function checkUnitsEarned(unitTotal, result) {
  const rows = unitTotal.lines.map(parseRow).filter(Boolean);
  const usc = rows.filter(
    (row) => row.term !== TRANSFER_TOTAL_TERM && !isInProgress(row) && sourceOf(row) === "usc"
  );
  const counted = sum(usc.map((row) => row.units)) + result.units.transferTotal;
  if (result.units.earned === null || !same(counted, result.units.earned)) {
    throw new StarsParseError(
      "unitsEarned",
      `Units don't add up: the course list gives ${counted} but the report says ${result.units.earned} earned.`
    );
  }
}

// Check 4 (warning): in-progress rows in the master list equal IN-PROCESS.
// Nothing to reconcile when the master list prints no IN-PROCESS line.
function checkUnitsInProgress(unitTotal, result) {
  if (!unitTotal.lines.some((line) => IN_PROCESS.test(line))) return;
  const rows = unitTotal.lines.map(parseRow).filter(Boolean).filter(isInProgress);
  const counted = sum(rows.map((row) => row.units));
  if (!same(counted, result.units.inProgress)) {
    result.meta.warnings.push({
      check: "unitsInProgress",
      message: `Your in-progress courses add up to ${counted} units, but your report says ${result.units.inProgress}. Check the in-progress list.`,
    });
  }
}

// Check 5 (warning): the printed class level matches the units earned.
function checkClassLevel(result) {
  const expected = classLevelFor(result.units.earned);
  if (result.classLevel !== expected) {
    result.meta.warnings.push({
      check: "classLevel",
      message: `Your report says ${result.classLevel ?? "no class level"}, but ${result.units.earned} units earned would make you a ${expected}. Check your class level.`,
    });
  }
}

// Check 6: every course row anywhere in the report is in the course list.
// Only the master list and "other courses" are read as the record, and
// transfer rows are also taken from requirement blocks (stage 5), so a USC
// row that shows up in some other block but not in the record is a course
// the parser would silently drop. That's the "right pattern, wrong part of
// the document" bug, caught by what the report lists rather than by what its
// headings say, so a requirement worded in a way no sample has shown doesn't
// fail the parse.
function checkUncollected(bs, result) {
  const collected = new Set(
    [...result.completedCourses, ...result.inProgressCourses].map((c) => `${c.term}|${c.rawCode}`)
  );
  for (const b of bs) {
    for (const line of b.lines) {
      const row = parseRow(line);
      if (!row || row.term === TRANSFER_TOTAL_TERM || collected.has(`${row.term}|${row.rawCode}`)) continue;
      throw new StarsParseError(
        "uncollectedRows",
        `${row.term} ${row.code} is listed under "${b.heading.slice(0, 60)}" but isn't in the course list.`
      );
    }
  }
}

// Checks 1 and 2 run before fields are read, since reading needs the
// landmarks. Checks 3–6 run on the result.
export function checkStructure(bs) {
  checkLandmarks(bs);
  checkMasterListRows(bs.find((b) => b.label === "unitTotal"));
}

export function checkResult(bs, result) {
  const unitTotal = bs.find((b) => b.label === "unitTotal");
  checkUnitsEarned(unitTotal, result);
  checkUncollected(bs, result);
  checkUnitsInProgress(unitTotal, result);
  checkClassLevel(result);
  return result;
}
