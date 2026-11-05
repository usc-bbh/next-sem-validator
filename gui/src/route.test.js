import { test } from "node:test";
import assert from "node:assert/strict";
import { pageFromHash, hashForPage } from "./route.js";

test("#/about opens the About page", () => {
  assert.equal(pageFromHash("#/about"), "about");
  assert.equal(pageFromHash("#/about/"), "about");
});

test("anything else is the main page", () => {
  for (const h of ["", "#", "#/", "#/aboutx", "#about"]) assert.equal(pageFromHash(h), "home");
});

test("each page's hash reads back as that page", () => {
  for (const p of ["about", "home"]) assert.equal(pageFromHash(hashForPage(p)), p);
});
