import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadProblem, describeResult, redactedName, MAX_UPLOAD_MB } from "./redact.js";
import { REDACTOR_FILES, REDACTOR_SOURCE_DIR } from "./redactorAssets.js";
import { syncRedactor } from "../scripts/sync-redactor.mjs";

const pdf = (extra = 0) => new TextEncoder().encode("%PDF-1.7\n" + " ".repeat(extra)).buffer;

test("only a real PDF under the size limit is redacted", () => {
  assert.equal(uploadProblem("report.pdf", pdf()), null);
  assert.equal(uploadProblem("REPORT.PDF", pdf()), null);
  assert.match(uploadProblem("report.png", pdf()), /not a PDF/);
  assert.match(uploadProblem("report.pdf", new TextEncoder().encode("PNG....").buffer), /isn't one inside/);
  assert.match(uploadProblem("report.pdf", new ArrayBuffer(MAX_UPLOAD_MB * 1024 * 1024 + 1)), /over 10 MB/);
});

test("a clean run is downloadable; a name fragment left behind says to check", () => {
  assert.deepEqual(describeResult({ status: "REDACTED", code: "OK" }).ok, true);
  const review = describeResult({ status: "REVIEW", code: "OK" });
  assert.equal(review.ok, true);
  assert.equal(review.tone, "warn");
  assert.match(review.text, /Part of your name may still appear/);
});

test("every failure gives no file and says why", () => {
  for (const code of ["NO_TEXT", "NOT_STARS", "TOO_MANY_PAGES", "TIMEOUT", "UNREADABLE", "VERIFY_FAILED", "ERROR", undefined]) {
    const v = describeResult({ status: "FAILED", code, pages: 40 });
    assert.equal(v.ok, false, code);
    assert.ok(v.text.length > 20, code);
  }
  assert.match(describeResult({ code: "TOO_MANY_PAGES", pages: 40 }).text, /40 pages/);
  assert.match(describeResult({ code: "VERIFY_FAILED" }).text, /don't share the original/);
});

test("redacted files are named like the Redactor's, without stacking", () => {
  assert.equal(redactedName("stars.pdf"), "REDACTED_stars.pdf");
  assert.equal(redactedName("REDACTED_stars.pdf"), "REDACTED_stars.pdf");
  assert.equal(redactedName(""), "REDACTED_STARS-report.pdf");
});

// The worker fetches a fixed list of files; a file added to the engine but not
// to the list would fail to import in the browser only.
test("the engine files listed, vendored, synced and fetched by the worker all match", () => {
  const vendored = readdirSync(REDACTOR_SOURCE_DIR).filter((f) => f.endsWith(".py")).sort();
  assert.deepEqual([...REDACTOR_FILES].sort(), vendored);
  const target = mkdtempSync(join(tmpdir(), "regcheck-redactor-"));
  syncRedactor(target);
  assert.deepEqual(readdirSync(target).sort(), vendored);
  const worker = readFileSync("public/redact-worker.js", "utf8");
  const listed = JSON.parse(worker.match(/const FILES = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(listed.sort(), vendored);
});

test("the vendored engine says which STARSRedacter commit it came from", () => {
  assert.match(readFileSync("../redactor/SOURCE.md", "utf8"), /commit `[0-9a-f]{40}`/);
});
