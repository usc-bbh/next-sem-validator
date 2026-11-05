import { test } from "node:test";
import assert from "node:assert/strict";
import { resultSummary, isLowUnits } from "./resultSummary.js";

const result = (overall_status, warnings = []) => ({ overall_status, summary: { total_units: 0, warnings } });

// The low unit notice sat above the banner and the validator's warnings were
// squeezed into its subtitle; both now list under the banner.
test("the low unit count joins the validator's warnings, first", () => {
  const { warnings } = resultSummary(result("warning", ["Planned load is 22 units, above the recommended max of 18."]), 8, 2);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^Low unit count: 8 units is below/);
  assert.match(warnings[1], /^Planned load is 22 units/);
});

test("a schedule-wide warning turns 'looks good' into 'needs reviewing'", () => {
  assert.equal(resultSummary(result("valid"), 8, 2).status, "warning");
  assert.equal(resultSummary(result("valid"), 16, 4).status, "valid");
});

test("a blocker stays a blocker", () => {
  assert.equal(resultSummary(result("invalid"), 8, 2).status, "invalid");
});

test("no result, nothing to show", () => {
  assert.deepEqual(resultSummary(null, 8, 2), { status: null, warnings: [] });
});

test("low units needs a course with units", () => {
  assert.equal(isLowUnits(0, 0), false);
  assert.equal(isLowUnits(0, 1), false);
  assert.equal(isLowUnits(11.5, 3), true);
  assert.equal(isLowUnits(12, 3), false);
});
