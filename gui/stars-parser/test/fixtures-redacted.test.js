// Every committed STARS fixture must be redacted. This runs over every
// fixtures/stars/*.txt, so a fixture that leaks can't be committed with the
// suite green. See STARS_PARSER_DESIGN.md §10.
//
// The rules follow doc 01 in bbh-course-reg-project ("Where the personal
// information sits") and what STARSRedacter replaces: the name and ID in the
// preamble, the diploma name and mailing address, every letter grade (with a
// token: Lp, Lf, Pp, Pn) and every GPA (with X.XXX).
//
// The preamble check is an allowlist. A line it doesn't recognise fails, so
// a new report with a new kind of preamble line needs a look before it's
// committed, and then a pattern here.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/stars");
const FIXTURES = fs.readdirSync(DIR).filter((f) => f.endsWith(".txt"));

const PREAMBLE_ALLOWED = [
  // The browser's print header: a timestamp, in either locale.
  /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}( [AP]M)? +USC STARS Report$/,
  // The student line, with only redaction Xs where the name and ID were.
  /^STARS Report for ?X+(?: X+)* +(?:ID#: ?X+|X{4} X+)$/,
  // The program code and title, e.g. "1915 Arti fi cial Intelligence for Business".
  /^\d{1,4} [A-Za-z][A-Za-z ,&()-]*$/,
  /^Print Report$/,
  /^You may directly access the following sections in the STARS report$/,
  /^Completed degree requirements are indicated using blue text/,
  /^Outstanding requirements needed to graduate are indicated with red text/,
  /^Courses with a 5-digit code indicate the year and semester\.$/,
  /^Codes ending in 1 – Spring, 2 – Summer, 3 – Fall\./,
  // The section menu.
  /^(?:Pertinent Data Section|Major Requirements|Minor Requirements|Legend|Current Registration|Other courses in your academic account|Units Required for Degree|University and Major GPA|General Education Requirements|Skill Level and Pre-Major Requirements|Physical Education Units)$/,
];

// Grades that are allowed to print unredacted: none of them is a letter grade.
const NON_LETTER_GRADES = new Set(["Lp", "Lf", "Pp", "Pn", "CR", "NC", "TR", "RG", "W", "IN", "IX", "MG", "NS"]);

const COURSE_ROW = /^( *)\d{5} [A-Z0-9]/;

for (const name of FIXTURES) {
  const lines = fs.readFileSync(path.join(DIR, name), "utf8").split("\n");

  test(`${name}: the preamble holds nothing but fixed text and Xs`, () => {
    const end = lines.findIndex((line) => line.startsWith("PREPARED:"));
    assert.ok(end > 0, "no PREPARED: line");
    for (const line of lines.slice(0, end)) {
      const t = line.trim();
      if (t === "") continue;
      assert.ok(PREAMBLE_ALLOWED.some((re) => re.test(t)), `unrecognised preamble line: ${t}`);
    }
  });

  test(`${name}: the diploma name and address are redacted`, () => {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith("Name as it will appear on your USC Diploma:")) continue;
      for (let j = i + 1; j < lines.length && !lines[j].startsWith("====="); j++) {
        const rest = lines[j].replace(/^Diploma will be mailed to:/, "").trim();
        assert.match(rest, /^(?:X+(?: X+)*)?$/, `diploma block line: ${lines[j].trim()}`);
      }
    }
  });

  test(`${name}: no student-ID-shaped number`, () => {
    for (const line of lines) {
      assert.doesNotMatch(line, /(?<!\d)\d{10}(?!\d)/, line.trim());
    }
  });

  test(`${name}: every course row's grade is a redaction token or a non-letter grade`, () => {
    for (const line of lines) {
      const m = line.match(COURSE_ROW);
      if (!m) continue;
      const t = m[1].length;
      if (!/^ *\d+\.\d$/.test(line.slice(t + 19, t + 23))) continue; // the legend's "20263 = FALL…"
      const grade = line.slice(t + 24, t + 26).trim();
      assert.ok(NON_LETTER_GRADES.has(grade), `grade "${grade}" in: ${line.trim()}`);
    }
  });

  test(`${name}: every GPA is X.XXX`, () => {
    for (const line of lines) {
      assert.doesNotMatch(line, /\b\d\.\d{3}\b/, line.trim());
    }
  });
}
