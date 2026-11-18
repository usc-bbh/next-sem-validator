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
    // Safari: the title first, the time split at its colon, "Page n of m".
    "USC STARS Report                       11/2/26, 12 : 41 AM",
    "XXXXXXXXXXXXXXXXXXXXXXX                Page 2 of 7",
    // The single-column printout: the page number alone.
    "                               Page 3 of 9",
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
    assert.doesNotMatch(out, /USC STARS Report/, name);
    assert.doesNotMatch(out, /^(?:X+ +)?\d+\/\d+$/m, name);
    assert.doesNotMatch(out, /Page \d+ of \d+/, name);
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
    [["header", null], ["unitTotal", "NO"], ["requirement", "OK"]]
  );
});

test("a heading that wraps is labelled from both lines", () => {
  const [b] = blocks("NO     A MINIMUM OF 128 UNITS IS REQUIRED FOR\n       DEGREE COMPLETION:\n");
  assert.equal(b.label, "unitTotal");
});

// Requirement headings used to be listed one by one, from the samples' majors.
// A heading no sample had shown came out "unknown", and an unknown block with
// courses failed the parse: an IR major's extra unit requirement and an
// athlete's NCAA section both did. A block is now labelled by its shape.
test("a block no sample has shown is labelled by its shape", () => {
  const ir = blocks(
    "NO     PLEASE NOTE THE FOLLOWING ADDITIONAL UNIT REQUIREMENT FOR\n       IR MAJORS:\n" +
      "IP-  1) A MINIMUM OF 8 UPPER DIVISION COURSES (32 UNITS)\n      20261 IR  321       4.0 Lp    Civil War, Peace Building and\n"
  )[0];
  assert.deepEqual([ir.label, ir.courses, ir.status], ["requirement", "repeat", "NO"]);
  const ncaa = blocks(
    "      TOTAL ELECTIVE HOURS THAT MAY APPLY TO SATISFACTORY\n      PROGRESS REQUIREMENTS: 13.66.\n      20241 SOC250       3.3 TR    MEDIA AND SOCIETY\n"
  )[0];
  assert.deepEqual([ncaa.label, ncaa.courses], ["requirement", "repeat"]); // no status, but it lists courses
  const track = blocks("YOU MUST COMPLETE ONE TRACK CHOSEN IN CONSULTATION WITH YOUR\nADVISOR.\n")[0];
  assert.deepEqual([track.label, track.courses], ["notice", "none"]);
});

// The label table for every undergrad fixture. A change to the anchors or the
// structural rule that moves any block shows up here.
const EXPECTED = {
  aibiz_jr_doubledegree: "header pertinentData notice notice notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement notice requirement requirement otherCourses legend notice notice requirement notice notice",
  aibiz_so: "header pertinentData notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement notice requirement requirement requirement otherCourses legend notice requirement notice notice",
  aibiz_sr_forgiveness: "header pertinentData notice notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement notice requirement requirement otherCourses requirement legend notice requirement notice notice",
  aibiz_sr_minor: "header pertinentData notice notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement notice requirement minor requirement requirement otherCourses legend notice notice requirement notice notice",
  amcm_jr: "header pertinentData notice notice notice unitTotal gpa requirement requirement gpa requirement requirement requirement requirement notice requirement requirement requirement requirement requirement requirement otherCourses legend notice requirement notice notice",
  buad_fr: "header pertinentData notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement requirement requirement requirement requirement otherCourses legend notice requirement notice notice",
  buad_jr_ib: "header pertinentData notice notice notice unitTotal requirement requirement gpa gpa requirement notice requirement requirement requirement requirement requirement requirement minor requirement requirement otherCourses legend notice requirement notice notice",
  cpns_so: "header pertinentData notice notice notice unitTotal gpa requirement requirement gpa requirement requirement requirement requirement notice requirement requirement requirement requirement requirement otherCourses legend notice requirement notice notice",
  csci_sr_renaissance: "header pertinentData notice notice notice notice unitTotal requirement requirement gpa gpa requirement requirement requirement requirement requirement requirement requirement minor requirement requirement requirement otherCourses legend requirement notice requirement notice notice",
  ecds_so_minor: "header pertinentData notice notice notice unitTotal gpa requirement requirement gpa requirement requirement requirement requirement notice requirement requirement requirement minor requirement requirement otherCourses legend notice requirement notice notice",
  ene_fr_withdrawals: "header pertinentData notice notice unitTotal requirement requirement gpa gpa requirement requirement requirement requirement requirement requirement requirement requirement requirement otherCourses legend notice requirement notice notice",
  envs_sr_athlete: "header pertinentData notice notice notice unitTotal gpa requirement requirement gpa requirement requirement requirement requirement notice requirement requirement requirement notice requirement notice requirement otherCourses legend notice requirement requirement requirement requirement requirement notice notice notice notice notice notice notice",
  psyc_so_thematic: "header pertinentData notice notice notice unitTotal gpa requirement requirement gpa requirement requirement requirement requirement notice requirement requirement requirement requirement requirement requirement otherCourses legend notice requirement notice notice",
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
