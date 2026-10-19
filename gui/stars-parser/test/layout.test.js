// Stage 2 tests: rebuilding lines and columns from pdf.js fragments.
//
//   cd gui && npm test
//
// Fragments are built by hand, positioned the way the sample PDFs position
// them, so these run without a PDF or a browser.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { layout, measure, groupLines, layoutProblems } from "../layout.js";

const US = 3.61; // character width on US-locale prints
const EU = 3.30; // and on the European-locale one

// A fragment of fixed-width body text starting at column `col`.
const at = (str, col, y, cw = US, left = 122.82) => ({
  str,
  x: left + col * cw,
  y,
  width: str.length * cw,
  height: 6,
});

const DIVIDER = "_".repeat(65);

// One course row the way pdf.js splits it: a fragment per word, the spaces
// as fragments of their own, and the redaction token 0.16pt below the row.
function courseRow(y, { cw = US, left = 122.82, grade = "Lp", gradeDy = -0.16 } = {}) {
  return [
    at("20243", 6, y, cw, left),
    at(" ", 11, y, cw, left),
    at("BUAD312", 12, y, cw, left),
    at("G", 23, y, cw, left),
    at("4.0", 26, y, cw, left),
    at(grade, 30, y + gradeDy, cw, left),
    at("Statistics", 36, y, cw, left),
  ];
}

const ROW_TEXT = "      20243 BUAD312    G  4.0 Lp    Statistics";

test("a grade 0.16pt below its row stays on the row", () => {
  const text = layout([[at(DIVIDER, 0, 700), ...courseRow(691)]]);
  assert.equal(text.split("\n")[1], ROW_TEXT);
});

test("rows 9pt apart are never merged", () => {
  const page = [at(DIVIDER, 0, 700), ...courseRow(691), ...courseRow(682)];
  const lines = groupLines(page);
  assert.equal(lines.length, 3);
});

test("the tolerance is 2pt, not more", () => {
  const near = groupLines([at("A", 0, 700), at("B", 5, 698.1)]);
  const far = groupLines([at("A", 0, 700), at("B", 5, 697.9)]);
  assert.equal(near.length, 1);
  assert.equal(far.length, 2);
});

test("fragments land in their columns, so gaps keep their width", () => {
  const text = layout([[at(DIVIDER, 0, 700), at("IR", 12, 691), at("101", 16, 691)]]);
  assert.equal(text.split("\n")[1], "            IR  101");
});

test("a flag drawn flush against the title stays flush", () => {
  const row = [
    at(DIVIDER, 0, 700),
    at("20262", 6, 691),
    at("BUAD302", 12, 691),
    at("4.0", 26, 691),
    at("RG", 30, 691),
    at(">IP", 33, 691),
    at("Communication", 36, 691),
  ];
  assert.equal(
    layout([row]).split("\n")[1],
    "      20262 BUAD302       4.0 RG >IPCommunication"
  );
});

test("the European-locale character width gives the same columns", () => {
  const page = [at(DIVIDER, 0, 700, EU, 136.2), ...courseRow(691, { cw: EU, left: 136.2 })];
  assert.equal(measure(page).charWidth, EU);
  assert.equal(layout([page]).split("\n")[1], ROW_TEXT);
});

test("space fragments' wrong widths don't affect the character width", () => {
  const spaces = Array.from({ length: 50 }, (_, i) => ({
    str: " ", x: 130 + i * 4, y: 600, width: 4.82, height: 0,
  }));
  assert.equal(measure([at("PREPARED:", 0, 700), ...spaces]).charWidth, US);
});

test("the margin comes from divider rows, not a fragment at the page edge", () => {
  // STARSRedacter covers the footer URL with Xs drawn in the body's width
  // but far left of the body.
  const footer = { str: "XXXXXXXXXX", x: 25, y: 30, width: 10 * US, height: 6 };
  const page = [at(DIVIDER, 0, 700), ...courseRow(691), footer];
  const { left } = measure(page);
  assert.equal(left, 122.82);
  assert.equal(layout([page]).split("\n")[1], ROW_TEXT);
});

test("proportional text outside the body is kept, with a space between", () => {
  // The browser's own header uses a proportional font, so its fragments can
  // overlap in column terms. They must not be glued together.
  const header = [
    { str: "7/2/26, 7:26 PM", x: 20, y: 770, width: 40, height: 6 },
    { str: "USC STARS Report", x: 30, y: 770, width: 45, height: 6 },
  ];
  const text = layout([[...header, at(DIVIDER, 0, 700)]]);
  assert.equal(text.split("\n")[0], "7/2/26, 7:26 PM USC STARS Report");
});

test("pages are laid out in order, top of each page first", () => {
  const text = layout([
    [at("PAGE ONE LOW", 0, 100), at("PAGE ONE HIGH", 0, 700), at(DIVIDER, 0, 400)],
    [at("PAGE TWO", 0, 700)],
  ]);
  assert.deepEqual(text.trimEnd().split("\n"), [
    "PAGE ONE HIGH",
    DIVIDER,
    "PAGE ONE LOW",
    "PAGE TWO",
  ]);
});

test("layoutProblems catches a grade orphaned on its own line", () => {
  const exact = layout([[at(DIVIDER, 0, 700), ...courseRow(691, { gradeDy: -3 })]]);
  assert.match(layoutProblems(exact, 1).join(), /hold only a grade/);
});

test("layoutProblems catches two course rows merged into one line", () => {
  const merged =
    "      20243 BUAD312    G  4.0 Lp    Statistics      20251 CSCI103  L    4.0 Lp    Intro\n";
  assert.match(layoutProblems(merged, 1).join(), /two course rows/);
});

test("layoutProblems passes a clean layout", () => {
  const lines = [DIVIDER, ROW_TEXT, ...Array(20).fill("TEXT")];
  assert.deepEqual(layoutProblems(lines.join("\n"), 1), []);
});

// The committed fixtures are stage 2's output, so the sanity gates must hold
// on every one of them.
const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/stars");

for (const name of fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".txt"))) {
  test(`${name}: passes the layout sanity gates`, () => {
    const text = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
    const pages = Number(text.match(/ (\d+)\/\1\n/)?.[1] ?? 1);
    assert.deepEqual(layoutProblems(text, pages), []);
  });
}
