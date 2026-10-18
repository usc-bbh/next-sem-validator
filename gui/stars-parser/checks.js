// Stage 6 — check, and fail loudly. See STARS_PARSER_DESIGN.md §9.
//
// Hard checks throw StarsParseError naming the check, so the parser never
// returns a partial result. Warnings go into meta.warnings and the parse
// still succeeds: they cover things the validator doesn't depend on, so a
// surprising but readable report doesn't lock a student out.

import { COURSE_ROW } from "./blocks.js";
import { parseRow, isInProgress, sourceOf, TRANSFER_TOTAL_TERM } from "./fields.js";

export class StarsParseError extends Error {
  // `check` is a short id: "notStars", "graduate", "landmarks",
  // "masterListRows", "unitsEarned", "unlabelledRows".
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
function checkUnitsInProgress(unitTotal, result) {
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

// Check 6: no unlabelled block holds course rows. That would be the "right
// pattern, wrong part of the document" bug. Unlabelled blocks without rows
// are only reported.
function checkUnlabelled(bs, result) {
  for (const b of bs.filter((b) => b.label === "unknown")) {
    if (b.lines.some((line) => COURSE_ROW.test(line))) {
      throw new StarsParseError(
        "unlabelledRows",
        `A part of the report we don't recognise lists courses: ${b.heading.slice(0, 80)}`
      );
    }
    result.meta.warnings.push({ check: "unknownBlock", message: `Unrecognised section: ${b.heading.slice(0, 80)}` });
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
  checkUnlabelled(bs, result);
  checkUnitsEarned(unitTotal, result);
  checkUnitsInProgress(unitTotal, result);
  checkClassLevel(result);
  return result;
}
