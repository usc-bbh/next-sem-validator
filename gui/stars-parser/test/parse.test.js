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

test("all 13 undergrad samples have expected output", () => {
  assert.equal(SAMPLES.length, 13);
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

const OTHER = "OTHER COURSES IN YOUR ACADEMIC ACCOUNT:";
const withBlock = (block) => SAMPLE.replace(OTHER, block + "_".repeat(65) + "\n" + OTHER);

// A requirement worded the way no sample words it, listing a course that's
// already in the record, used to fail the parse ("unlabelledRows"). That's
// what stopped an IR double major and an Environmental Studies athlete.
test("a requirement no sample has shown, listing a course already in the record, parses", () => {
  const r = parseStarsText(
    withBlock("NO     A BRAND NEW KIND OF REQUIREMENT:\n      20253 CSCI170       4.0 Lp    Discrete Methods in Computer\n")
  );
  assert.deepEqual(r, parseStarsText(SAMPLE));
});

test("check 6: a USC course listed outside the record fails the parse", () => {
  // CSCI 104 isn't in the master list or "other courses", so it would be lost.
  throwsCheck(
    withBlock("NO     A BRAND NEW KIND OF REQUIREMENT:\n      20253 CSCI104       4.0 Lp    Data Structures and Object\n"),
    "uncollectedRows"
  );
});

test("a transfer listed only in a requirement no sample has shown is collected", () => {
  const r = parseStarsText(
    withBlock("NO     A BRAND NEW KIND OF REQUIREMENT:\n      20232 AP20:COMP     4.0 TR    AP BIOLOGY\n")
  );
  assert.ok(r.completedCourses.some((c) => c.rawCode === "AP20:COMP" && c.source === "exam"));
});

test("a section no sample has shown, with no courses, is a notice and adds no warning", () => {
  const r = parseStarsText(withBlock("SOMETHING NEW AND HARMLESS\n"));
  assert.deepEqual(r.meta.warnings, []);
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

// Reports from outside the business school, which the parser used to fail on
// or misread.
test("an Environmental Studies athlete's single-column report", () => {
  const text = read("envs_sr_athlete.txt");
  const r = parseStarsText(text);
  assert.equal(r.meta.programCode, "1381"); // printed "PROGRAM CODE: 1381"
  assert.equal(r.units.earned, 97);
  // Prepared in June: the master list has no IN-PROCESS line, so the units of the courses
  // listed for next term stand in for it, and there's nothing for check 4 to warn about.
  assert.equal(r.units.inProgress, 18);
  assert.deepEqual(r.meta.warnings, []);
  // Courses listed only in the concentration block and in "other courses".
  assert.ok(r.completedCourses.some((c) => c.rawCode === "ENVH311" && c.source === "transfer"));
  assert.deepEqual(r.inProgressCourses.map((c) => c.code), ["PSYC 274", "ANTH 316", "ENST 320B", "ENST 450", "ENST 492"]);
  // This report prints the GPA as "3.166 AVE", not "3.166 GPA".
  const unredacted = text.replace(/(OF ALL USC BACCALAUREATE UNITS[\s\S]*?EARNED: +)X\.XXX AVE/, (_, before) => `${before}3.166 AVE`);
  assert.equal(parseStarsText(unredacted).gpa, 3.166);
});

test("the degree comes from this report's CURRENT POST row, for any degree", () => {
  // A double major: the IR report's post is a BA, the other a BS.
  const dd = read("aibiz_jr_doubledegree.txt");
  const ir = dd
    .replace("PROGRAM: 1915", "PROGRAM: 242")
    .replace("BACHELOR OF SCIENCE\nARTIFICIAL INTELLIGENCE FOR BUSINESS", "BACHELOR OF ARTS\nINTERNATIONAL RELATIONS");
  assert.notEqual(ir, dd);
  const r = parseStarsText(ir);
  assert.equal(r.degree, "BA");
  assert.equal(r.major, "International Relations");
  // A degree the title line has no abbreviation for.
  const bfa = read("ecds_so_minor.txt").replace("BACHELOR OF SCIENCE", "BACHELOR OF FINE ARTS").replace(/( 1824 +)BS( +ECDS)/, "$1BFA$2");
  assert.equal(parseStarsText(bfa).degree, "BFA");
});
