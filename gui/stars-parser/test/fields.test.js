// Stage 5 tests: reading course rows by column, and classifying them.
// Every row here is copied from a sample report.

import test from "node:test";
import assert from "node:assert/strict";

import { parseRow, normalizeCode, sourceOf, passed, isInProgress, titleCase } from "../fields.js";

const row = (line) => {
  const r = parseRow(line);
  assert.ok(r, `didn't parse: ${line}`);
  return r;
};

test("an ordinary row", () => {
  assert.deepEqual(row("      20243 BUAD312    G  4.0 Lp    Statistics and Data Science f"), {
    term: "20243",
    rawCode: "BUAD312",
    code: "BUAD 312",
    suffixes: ["G"],
    units: 4,
    grade: "Lp",
    flags: [],
    title: "Statistics and Data Science f",
  });
});

test("a flag glued to the title splits cleanly", () => {
  const r = row("      20262 BUAD302       4.0 RG >IPCommunication Strategy in Bus");
  assert.deepEqual(r.flags, [">IP"]);
  assert.equal(r.title, "Communication Strategy in Bus");
});

test("a two-character flag", () => {
  const r = row("      20261 BUAD104       0.0 CR >D Learning About International");
  assert.deepEqual(r.flags, [">D"]);
  assert.equal(r.title, "Learning About International");
});

test("suffixes with spaces in them, and combined suffixes", () => {
  assert.deepEqual(row("      20251 PHIL246  L G  4.0 Lp    Formal Logic").suffixes, ["L", "G"]);
  assert.deepEqual(row("      20253 CHEM205  LXG  4.0 Lp    Chemistry").suffixes, ["L", "X", "G"]);
  assert.deepEqual(row("      20251 IR  101   XGW 4.0 Lp    International Relations").suffixes, ["X", "G", "W"]);
  assert.deepEqual(row("      20253 CORE102    GP 4.0 Lp    Culture and Values: Thematic").suffixes, ["G", "P"]);
});

test("a padded code keeps its raw form and normalises", () => {
  const r = row("      20251 IR  101   XGW 4.0 Lp    International Relations");
  assert.equal(r.rawCode, "IR  101");
  assert.equal(r.code, "IR 101");
});

test("codes longer than nine characters are read to their end", () => {
  const total = row("      99993 TRNSFR WORK  28.0 TR    Total Transfer Units");
  assert.equal(total.rawCode, "TRNSFR WORK");
  assert.equal(total.units, 28);
  const generic = row("      20222 TR-BUSINESS   3.0 TR    INTRO TO BUSINESS");
  assert.equal(generic.rawCode, "TR-BUSINESS");
  assert.deepEqual(generic.suffixes, []);
  assert.equal(row("      20241 HIS/AMERIC    6.0 TR    IBTEST: HISTORY AMERICAS").rawCode, "HIS/AMERIC");
});

test("exam and transfer codes pass through unchanged", () => {
  assert.equal(row("      20232 AP34:COMP     4.0 TR    AP MICROECONOMICS").code, "AP34:COMP");
  assert.equal(row("      20243 TR-COMP-2     4.0 TR    READING AND COMPOSITION 2").code, "TR-COMP-2");
});

test("a W row", () => {
  const r = row("      20253 CE  110       0.0 W     Introduction to Environmental");
  assert.equal(r.grade, "W");
  assert.equal(r.units, 0);
});

test("the legend's term lines aren't course rows", () => {
  assert.equal(parseRow("20263 = FALL SEMESTER 2026       >D = CREDIT DELETED, BUT"), null);
});

test("normalizeCode matches the validator's spacing", () => {
  assert.equal(normalizeCode("BUAD312"), "BUAD 312");
  assert.equal(normalizeCode("CHEM105A"), "CHEM 105A");
  assert.equal(normalizeCode("ITP 116"), "ITP 116");
  assert.equal(normalizeCode("DIPLOMA+2"), "DIPLOMA+2");
});

test("source is decided by what the row is, not just its TR grade", () => {
  const src = (line) => sourceOf(row(line));
  assert.equal(src("      20251 CSCI103  L    4.0 Lp    Introduction to Programming"), "usc");
  assert.equal(src("      20232 AP66:COMP     4.0 TR    AP CALCULUS AB"), "exam");
  assert.equal(src("      20241 ENGLISH       6.0 TR    IBTEST: ENGLISH"), "exam");
  assert.equal(src("      20241 DIPLOMA+2     2.0 TR    DIPLOMA 2 IB UNITS"), "exam");
  assert.equal(src("      20233 CMPR120       3.0 TR    INTRO TO PROGRAMMING"), "transfer");
  assert.equal(src("      20231 ANTH101       3.0 TR    PHYSICAL ANTHROPOLOGY"), "transfer");
  assert.equal(src("      20243 TR-COMP-2     4.0 TR    READING AND COMPOSITION 2"), "transfer_generic");
});

test("pass rule: W, failing tokens and deleted credit don't count as passed", () => {
  const p = (line) => passed(row(line));
  assert.equal(p("      20243 BUAD312    G  4.0 Lp    Statistics"), true);
  assert.equal(p("      20243 BUAD112       2.0 CR    AI for Business"), true);
  assert.equal(p("      20232 AP66:COMP     4.0 TR    AP CALCULUS AB"), true);
  assert.equal(p("      20253 CE  110       0.0 W     Introduction to Environmental"), false);
  assert.equal(p("      20243 ITP 216       0.0 Lf >FFApplications"), false);
  assert.equal(p("      20261 BUAD104       0.0 CR >D Learning About International"), false);
});

test("RG and >IP are in progress, and not yet passed or failed", () => {
  const r = row("      20263 CSCI360       4.0 RG >IPArtificial Intelligence: Prin");
  assert.equal(isInProgress(r), true);
  assert.equal(passed(r), null);
});

test("titleCase keeps small words lower", () => {
  assert.equal(titleCase("ARTIFICIAL INTELLIGENCE FOR BUSINESS"), "Artificial Intelligence for Business");
  assert.equal(titleCase("APPLIED AND COMPUTATIONAL MATHEMATICS"), "Applied and Computational Mathematics");
});
