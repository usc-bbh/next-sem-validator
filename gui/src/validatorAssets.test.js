import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { VALIDATOR_ASSETS } from "./validatorAssets.js";
import { syncValidator } from "../scripts/sync-validator.mjs";

// The app used to send a two-department mock (ACCT, BUCO), so every other
// department's D-clearance warning had no instructions.
test("the checker gets the real D-clearance rules, every department", () => {
  const rules = JSON.parse(readFileSync(VALIDATOR_ASSETS.deptClearance.from, "utf8"));
  assert.equal(rules._schema_version, "1.4"); // what the validator accepts
  const codes = rules.departments.map((d) => d.dept_code);
  assert.ok(codes.length > 50, `only ${codes.length} departments`);
  for (const code of ["CSCI", "ECON", "PSYC", "ACCT", "BUCO"]) assert.ok(codes.includes(code), `${code} missing`);
});

test("sync copies every file the app fetches, under the name it fetches", () => {
  const target = mkdtempSync(join(tmpdir(), "regcheck-sync-"));
  syncValidator(target);
  const copied = readdirSync(target);
  for (const { url } of Object.values(VALIDATOR_ASSETS)) {
    assert.ok(url.startsWith("./validator/"), url);
    assert.ok(copied.includes(basename(url)), `${url} not copied`);
  }
});
