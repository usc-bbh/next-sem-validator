// Stage 3 and 4 tests: cleaning, then splitting into labelled blocks.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clean } from "../clean.js";
import { blocks, COURSE_ROW } from "../blocks.js";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/stars");
const read = (name) => fs.readFileSync(path.join(DIR, `${name}.txt`), "utf8");

const DIVIDER = "_".repeat(65);

// ---- stage 3 ---------------------------------------------------------------

test("clean drops the preamble before PREPARED:", () => {
  const text = "STARS Report for XXXX   ID#: XXXX\nPrint Report\nPREPARED: 07/01/26 - 14:07\nPROGRAM: 1915\n";
  assert.equal(clean(text), "PREPARED: 07/01/26 - 14:07\nPROGRAM: 1915\n");
});

test("clean drops page headers and footers in both date formats", () => {
  const text = [
    "PREPARED: 07/01/26 - 14:07",
    "      20243 BUAD312    G  4.0 Lp    Statistics",
    "XXXXXXXXXXXXXXXXXXXXXXX                1/7",
    "7/2/26, 7:26 PM                        USC STARS Report",
    "28/09/2026, 18:42                      USC STARS Report",
    "https://example.usc.edu/stars/report   2/7",
    "      20251 CSCI103  L    4.0 Lp    Introduction",
  ].join("\n");
  assert.deepEqual(clean(text).trimEnd().split("\n"), [
    "PREPARED: 07/01/26 - 14:07",
    "      20243 BUAD312    G  4.0 Lp    Statistics",
    "      20251 CSCI103  L    4.0 Lp    Introduction",
  ]);
});

test("clean stops at END OF ANALYSIS and drops the web page's footer", () => {
  const text = [
    "PREPARED: 07/01/26 - 14:07",
    "************************ END OF ANALYSIS ************************",
    "Need help?",
    "Technical Issues: ITS Service Desk (213) 740-5555 | consult@usc.edu",
    "Privacy Notice | Notice of Non-Discrimination | Digital Accessibility",
  ].join("\n");
  assert.equal(clean(text).trimEnd().split("\n").length, 2);
});

test("clean leaves redacted values as printed", () => {
  const text = "PREPARED: 07/01/26 - 14:07\n    EARNED:              X.XXX GPA\n";
  assert.match(clean(text), /X\.XXX GPA/);
});

test("clean returns nothing for text with no PREPARED: line", () => {
  assert.equal(clean("not a STARS report\n"), "");
});

test("every fixture loses its preamble and all page furniture", () => {
  for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith(".txt"))) {
    const out = clean(fs.readFileSync(path.join(DIR, name), "utf8"));
    assert.ok(out.startsWith("PREPARED:"), name);
    assert.doesNotMatch(out, /USC STARS Report$/m, name);
    assert.doesNotMatch(out, /^X+ +\d+\/\d+$/m, name);
    assert.doesNotMatch(out, /STARS Report for|Need help\?/, name);
  }
});

// ---- stage 4 ---------------------------------------------------------------

test("blocks split on dividers and read the status code", () => {
  const bs = blocks(
    [
      "PREPARED: 07/01/26 - 14:07",
      DIVIDER,
      "NO     A MINIMUM OF 128 UNITS IS REQUIRED FOR DEGREE COMPLETION:",
      "      20243 BUAD312    G  4.0 Lp    Statistics",
      DIVIDER,
      DIVIDER,
      "OK     MATH REQUIREMENT:",
    ].join("\n")
  );
  assert.deepEqual(
    bs.map((b) => [b.label, b.status]),
    [["header", null], ["unitTotal", "NO"], ["math", "OK"]]
  );
});

test("a heading that wraps is labelled from both lines", () => {
  const [b] = blocks(
    "NO     A MINIMUM OF 16 UNITS MUST BE UNIQUE TO THE APPLIED\n       ANALYTICS MINOR:\n"
  );
  assert.equal(b.label, "minorUnique");
});

test("a block nobody has seen before is labelled unknown, not guessed", () => {
  const [b] = blocks("NO     SOME REQUIREMENT NO SAMPLE HAS SHOWN US:\n");
  assert.equal(b.label, "unknown");
});

// The label table for every undergrad fixture. A change to the anchors that
// moves any block shows up here.
const EXPECTED = {
  aibiz_jr_doubledegree: "header pertinentData summary notice notice notice unitTotal residence upperDivision gpa gpa writing notice thematicOption geGlobal math major notice major currentRegistration otherCourses legend internalAudit internalAudit internalAudit disclaimer end",
  aibiz_so: "header pertinentData summary notice unitTotal residence upperDivision gpa gpa writing notice geCore geGlobal math major notice major notice currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  aibiz_sr_forgiveness: "header pertinentData summary notice notice unitTotal residence upperDivision gpa gpa writing notice geCore geGlobal math accounting notice major currentRegistration otherCourses unitCaps legend internalAudit internalAudit disclaimer end",
  aibiz_sr_minor: "header pertinentData summary notice notice unitTotal residence upperDivision gpa gpa writing notice geCore geGlobal math accounting notice major minor minorUnique currentRegistration otherCourses legend internalAudit internalAudit internalAudit disclaimer end",
  amcm_jr: "header pertinentData summary notice notice unitTotal gpa residence upperDivision gpa deptLimit dornsife104 writing foreignLanguage notice geCore geGlobal major major major currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  buad_fr: "header pertinentData summary notice unitTotal residence upperDivision gpa gpa writing notice geCore geGlobal math econ major major notice currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  buad_jr_ib: "header pertinentData summary notice notice unitTotal residence upperDivision gpa gpa writing notice geCore geGlobal math econ accounting major minor minorUnique currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  cpns_so: "header pertinentData summary notice notice unitTotal gpa residence upperDivision gpa deptLimit dornsife104 writing foreignLanguage notice geCore geGlobal major major currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  csci_sr_renaissance: "header pertinentData summary notice notice notice unitTotal residence upperDivision gpa gpa deptLimit writing geCore geGlobal math major major minor minorUnique unitCaps currentRegistration otherCourses legend renaissance internalAudit internalAudit disclaimer end",
  ene_fr_withdrawals: "header pertinentData summary notice unitTotal residence upperDivision gpa gpa writing geCore geGlobal major math major major notice currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
  psyc_so_thematic: "header pertinentData summary notice notice unitTotal gpa residence upperDivision gpa deptLimit dornsife104 writing foreignLanguage notice thematicOption geGlobal major major major currentRegistration otherCourses legend internalAudit internalAudit disclaimer end",
};

for (const [name, labels] of Object.entries(EXPECTED)) {
  test(`${name}: label table`, () => {
    const bs = blocks(clean(read(name)));
    assert.equal(bs.map((b) => b.label).join(" "), labels);
  });

  test(`${name}: course rows sit only in blocks expected to hold them`, () => {
    for (const b of blocks(clean(read(name)))) {
      if (b.courses !== "none") continue;
      const rows = b.lines.filter((line) => COURSE_ROW.test(line));
      assert.deepEqual(rows, [], `${b.label}: ${b.heading}`);
    }
  });
}

test("the graduate report has a graduate data block and no master list", () => {
  const labels = blocks(clean(read("grad_apsy"))).map((b) => b.label);
  assert.ok(labels.includes("graduateData"));
  assert.ok(!labels.includes("unitTotal"));
});
