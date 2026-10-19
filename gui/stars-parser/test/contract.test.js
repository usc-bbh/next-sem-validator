// Every fixtures/stars/*.json must match the parser's output shape
// (STARS_PARSER_DESIGN.md §8), the hand-written mock_stars_report.json
// included. The real samples are the parser's own output, so this mostly
// guards the mock: it can't drift from what the parser actually produces.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/stars");

const isString = (v) => typeof v === "string";
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isStringOrNull = (v) => v === null || isString(v);
const isTerm = (v) => isString(v) && /^\d{5}$/.test(v);

function assertKeys(obj, keys, where) {
  assert.deepEqual(Object.keys(obj).sort(), [...keys].sort(), `${where}: keys`);
}

const COURSE_KEYS = ["term", "code", "rawCode", "title", "units", "grade", "suffixes", "flags", "source", "passed", "origin"];
const SOURCES = ["usc", "exam", "transfer", "transfer_generic"];

function assertCourse(c, where, inProgress) {
  assertKeys(c, COURSE_KEYS, where);
  assert.ok(isTerm(c.term), `${where}: term`);
  for (const k of ["code", "rawCode", "title", "grade"]) assert.ok(isString(c[k]), `${where}: ${k}`);
  assert.ok(isNumber(c.units), `${where}: units`);
  assert.ok(Array.isArray(c.suffixes) && c.suffixes.every(isString), `${where}: suffixes`);
  assert.ok(Array.isArray(c.flags) && c.flags.every(isString), `${where}: flags`);
  assert.ok(SOURCES.includes(c.source), `${where}: source ${c.source}`);
  assert.ok(["parsed", "student"].includes(c.origin), `${where}: origin`);
  if (inProgress) assert.equal(c.passed, null, `${where}: in-progress rows have passed: null`);
  else assert.equal(typeof c.passed, "boolean", `${where}: passed`);
}

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  test(`${name} matches the output shape`, () => {
    const r = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
    assertKeys(
      r,
      ["meta", "degree", "major", "classLevel", "entryTerm", "expectedGraduation", "gpa", "posts", "minors", "units", "completedCourses", "inProgressCourses", "equivalents", "waivedCourses"],
      name
    );

    assertKeys(r.meta, ["prepared", "programCode", "catalogYear", "redacted", "warnings"], `${name} meta`);
    assert.equal(typeof r.meta.redacted, "boolean");
    for (const w of r.meta.warnings) assertKeys(w, ["check", "message"], `${name} warning`);

    for (const k of ["degree", "major", "expectedGraduation"]) assert.ok(isStringOrNull(r[k]), `${name}: ${k}`);
    assert.ok(["Freshman", "Sophomore", "Junior", "Senior"].includes(r.classLevel), `${name}: classLevel`);
    assert.ok(isTerm(r.entryTerm), `${name}: entryTerm`);
    assert.ok(r.gpa === null || isNumber(r.gpa), `${name}: gpa`);

    for (const p of r.posts) {
      assertKeys(p, ["program", "degree", "major", "school", "term"], `${name} post`);
    }
    for (const m of r.minors) {
      assertKeys(m, ["name", "effectiveTerm", "catalogYear"], `${name} minor`);
    }
    assertKeys(r.units, ["required", "earned", "inProgress", "transferTotal"], `${name} units`);
    for (const v of Object.values(r.units)) assert.ok(isNumber(v), `${name}: units`);

    r.completedCourses.forEach((c, i) => assertCourse(c, `${name} completed[${i}]`, false));
    r.inProgressCourses.forEach((c, i) => assertCourse(c, `${name} inProgress[${i}]`, true));

    for (const e of r.equivalents) assertKeys(e, ["from", "to"], `${name} equivalent`);
    assert.ok(r.waivedCourses.every(isString), `${name}: waivedCourses`);
  });
}
