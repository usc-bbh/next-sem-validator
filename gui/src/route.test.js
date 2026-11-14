import { test } from "node:test";
import assert from "node:assert/strict";
import { pageFromHash, deptFromHash, hashForPage } from "./route.js";

test("#/about opens the About page", () => {
  assert.equal(pageFromHash("#/about"), "about");
  assert.equal(pageFromHash("#/about/"), "about");
});

test("#/feedback opens the Feedback page", () => {
  assert.equal(pageFromHash("#/feedback"), "feedback");
  assert.equal(pageFromHash("#/feedback/"), "feedback");
});

test("anything else is the main page", () => {
  for (const h of ["", "#", "#/", "#/aboutx", "#about", "#/feedbackx", "#feedback"]) assert.equal(pageFromHash(h), "home");
});

test("each page's hash reads back as that page", () => {
  for (const p of ["about", "feedback", "d-clearance", "home"]) assert.equal(pageFromHash(hashForPage(p)), p);
});

// The D-clearance notice links to one department's steps on the D-clearance page.
test("#/d-clearance opens the D-clearance page, optionally at one department", () => {
  assert.equal(pageFromHash("#/d-clearance"), "d-clearance");
  assert.equal(deptFromHash("#/d-clearance"), null);
  assert.equal(pageFromHash("#/d-clearance/BUCO"), "d-clearance");
  assert.equal(deptFromHash("#/d-clearance/BUCO"), "BUCO");
  assert.equal(deptFromHash("#/d-clearance/pre-e/"), "PRE-E");
  for (const h of ["#/d-clearancex", "#/d-clearance/BUCO/x", "#/d-clearance/<b>"]) assert.equal(pageFromHash(h), "home", h);
});

test("a department's hash reads back as that page and department", () => {
  const hash = hashForPage("d-clearance", "PRE-E");
  assert.equal(hash, "#/d-clearance/PRE-E");
  assert.equal(pageFromHash(hash), "d-clearance");
  assert.equal(deptFromHash(hash), "PRE-E");
  assert.equal(hashForPage("about", "BUCO"), "#/about"); // only the D-clearance page takes one
});
