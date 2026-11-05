import { test } from "node:test";
import assert from "node:assert/strict";
import { pageFromHash, hashForPage } from "./route.js";

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
  for (const p of ["about", "feedback", "home"]) assert.equal(pageFromHash(hashForPage(p)), p);
});
