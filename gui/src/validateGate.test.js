import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_STARS, canValidate, hasUsableReport, reportHint } from "./validateGate.js";

// Everything Validate needs except the report.
const ready = { courseCount: 1, needSections: [], catalogReady: true, checkerReady: true, validating: false };

// The page used to start with a demo Junior record, and Validate ran against
// it when the student never uploaded a report.
test("the page starts with no STARS report, not a demo record", () => {
  assert.equal(INITIAL_STARS.report, null);
  assert.equal(hasUsableReport(INITIAL_STARS.source), false);
});

test("Validate is off until a report is uploaded, even with everything else ready", () => {
  assert.equal(canValidate({ ...ready, source: INITIAL_STARS.source }), false);
  assert.equal(reportHint(INITIAL_STARS.source), "Upload your STARS report to validate.");
});

test("Validate stays off while the report isn't usable yet", () => {
  for (const source of ["parsing", "review", "graduate"]) {
    assert.equal(canValidate({ ...ready, source }), false, source);
  }
  assert.equal(reportHint("review"), "Confirm your STARS details to validate.");
  assert.equal(reportHint("parsing"), null); // the upload card says it's reading
});

test("a read or confirmed report turns Validate on", () => {
  for (const source of ["parsed", "confirmed"]) {
    assert.equal(canValidate({ ...ready, source }), true, source);
    assert.equal(reportHint(source), null, source);
  }
});

test("a report alone isn't enough: courses, sections and the checker are still required", () => {
  const source = "confirmed";
  assert.equal(canValidate({ ...ready, source, courseCount: 0 }), false);
  assert.equal(canValidate({ ...ready, source, needSections: ["CSCI 104"] }), false);
  assert.equal(canValidate({ ...ready, source, checkerReady: false }), false);
  assert.equal(canValidate({ ...ready, source, catalogReady: false }), false);
  assert.equal(canValidate({ ...ready, source, validating: true }), false);
});
