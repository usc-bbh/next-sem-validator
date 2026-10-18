// Whole-pipeline tests on text: parseStarsText(<name>.txt) must equal
// <name>.json for every sample, and each hard check must fail on a report
// broken in the way it guards against.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseStarsText, StarsParseError } from "../parse.js";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/stars");
const read = (file) => fs.readFileSync(path.join(DIR, file), "utf8");

// Every .txt with a matching .json. grad_apsy has no .json: it's refused.
const SAMPLES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".txt") && fs.existsSync(path.join(DIR, f.replace(/\.txt$/, ".json"))))
  .map((f) => f.replace(/\.txt$/, ""));

test("all 11 undergrad samples have expected output", () => {
  assert.equal(SAMPLES.length, 11);
});

for (const name of SAMPLES) {
  test(`${name}: parses to exactly ${name}.json`, () => {
    assert.deepEqual(parseStarsText(read(`${name}.txt`)), JSON.parse(read(`${name}.json`)));
  });
}

const throwsCheck = (text, check) =>
  assert.throws(
    () => parseStarsText(text),
    (err) => err instanceof StarsParseError && err.check === check
  );

const SAMPLE = read("aibiz_sr_minor.txt");

test("a graduate report is refused", () => {
  throwsCheck(read("grad_apsy.txt"), "graduate");
});

test("text that isn't a STARS report is refused", () => {
  throwsCheck("Some other PDF\nwith text in it\n", "notStars");
});

test("check 1: a missing landmark fails the parse", () => {
  throwsCheck(SAMPLE.replace("****  LEGEND  ****", "****  LEGENDARY  ****"), "landmarks");
  throwsCheck(SAMPLE.replace("CURRENT POST:", "CURRENT PLACE:"), "landmarks");
});

test("check 2: a master-list row that can't be read fails the parse", () => {
  // The units column shifted one place right.
  const broken = SAMPLE.replace(
    "      20243 ECON351   X   4.0 Lp    Microeconomics for Business\n      20243 ITP 116",
    "      20243 ECON351   X    4.0 Lp   Microeconomics for Business\n      20243 ITP 116"
  );
  assert.notEqual(broken, SAMPLE);
  throwsCheck(broken, "masterListRows");
});

test("check 3: a course missing from the master list fails the parse", () => {
  const broken = SAMPLE.replace("      20243 WRIT150       4.0 Lp    Writing and Critical Reasonin\n", "");
  assert.notEqual(broken, SAMPLE);
  throwsCheck(broken, "unitsEarned");
});

test("check 4 is only a warning", () => {
  const r = parseStarsText(SAMPLE.replace("IN-PROCESS: 24.00 UNITS", "IN-PROCESS: 28.00 UNITS"));
  assert.deepEqual(r.meta.warnings.map((w) => w.check), ["unitsInProgress"]);
});

test("check 5 is only a warning", () => {
  const r = parseStarsText(SAMPLE.replace("Current Class Level Senior", "Current Class Level Junior"));
  assert.equal(r.classLevel, "Junior");
  assert.deepEqual(r.meta.warnings.map((w) => w.check), ["classLevel"]);
});

test("check 6: course rows in a block nobody recognises fail the parse", () => {
  const unknown =
    "OTHER COURSES IN YOUR ACADEMIC ACCOUNT:";
  const broken = SAMPLE.replace(
    unknown,
    "NO     A BRAND NEW KIND OF REQUIREMENT:\n      20253 CSCI170       4.0 Lp    Discrete Methods in Computer\n" +
      "_".repeat(65) + "\n" + unknown
  );
  throwsCheck(broken, "unlabelledRows");
});

test("an unrecognised block without course rows is only a warning", () => {
  const r = parseStarsText(
    SAMPLE.replace(
      "OTHER COURSES IN YOUR ACADEMIC ACCOUNT:",
      "SOMETHING NEW AND HARMLESS\n" + "_".repeat(65) + "\nOTHER COURSES IN YOUR ACADEMIC ACCOUNT:"
    )
  );
  assert.deepEqual(r.meta.warnings.map((w) => w.check), ["unknownBlock"]);
});

// A few facts from the samples, stated directly so a reader doesn't have to
// dig through the .json files to see the model working.
test("transfers, equivalences and waivers on the samples", () => {
  const dd = parseStarsText(read("aibiz_jr_doubledegree.txt"));
  const anth = dd.completedCourses.find((c) => c.rawCode === "ANTH101");
  assert.equal(anth.source, "transfer");
  assert.deepEqual(dd.equivalents, [
    { from: "CMPR 120", to: "CSCI 113" },
    { from: "CMPR 131", to: "CSCI 114" },
  ]);
  assert.equal(dd.posts.length, 2);
  assert.equal(dd.major, "Artificial Intelligence for Business");

  const fg = parseStarsText(read("aibiz_sr_forgiveness.txt"));
  assert.deepEqual(fg.waivedCourses, ["DSCI 281", "TAC 115"]);

  const w = parseStarsText(read("ene_fr_withdrawals.txt"));
  assert.equal(w.units.required, 130);
  assert.deepEqual(
    w.completedCourses.filter((c) => c.grade === "W").map((c) => [c.code, c.passed]),
    [["CE 110", false], ["CHEM 105A", false], ["CTCS 190", false], ["ENGR 102", false], ["MATH 226", false]]
  );

  for (const name of SAMPLES) {
    const r = parseStarsText(read(`${name}.txt`));
    assert.equal(r.gpa, null, `${name}: every sample's GPA is redacted`);
    assert.equal(r.meta.redacted, true);
  }
});
