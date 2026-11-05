import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

// Vite compiles the JSX, so this renders the real component.
const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});
after(() => server.close());
const { default: About, COMPARISON } = await server.ssrLoadModule("/src/About.jsx");
const html = renderToStaticMarkup(createElement(About, { onBack() {} }));
const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

// Pages someone has opened and confirmed exist. A new link in About goes here
// only after that check.
const CHECKED_LINKS = [];

// About linked the registrar's D-clearance page and an advising page, and
// neither existed.
test("About links only to pages that have been checked", () => {
  for (const href of hrefs) assert.ok(CHECKED_LINKS.includes(href), `unchecked link in About: ${href}`);
});

test("About no longer links the dead registrar pages", () => {
  assert.ok(!html.includes("arr.usc.edu/services/registration/d-clearance"));
  assert.ok(!html.includes("arr.usc.edu/services/advisement"));
});

test("About still says where to go for D-clearance and advising", () => {
  assert.match(html, /Need D-clearance\?<\/b> Reach out to your department\./);
  assert.match(html, /For advising, reach out to your academic advisor\./);
});

// The limits list left out two things the checker can't do, so a student
// could read a pass as covering them (#11).
const notChecked = renderToStaticMarkup(createElement("div", null, ...COMPARISON.flatMap((row) => row.no)));

test("About's limits list says grade minimums aren't checked", () => {
  assert.match(notChecked, /Minimum grades in prerequisites/);
});

test("About's limits list says a double major's second report isn't read", () => {
  assert.match(notChecked, /A second STARS report/);
});

// Seat counts are a scrape-time snapshot, so RegCheck stopped checking them;
// About has to say so rather than leave a student assuming a pass means a seat.
// It sits once, in the "doesn't check" column, not as a row of its own.
test("About says seats aren't tracked", () => {
  assert.match(notChecked, /Open seats: a section you pick may be full when you register/);
  const checked = renderToStaticMarkup(createElement("div", null, ...COMPARISON.flatMap((row) => row.yes)));
  assert.doesNotMatch(checked, /seat/i);
  assert.ok(!COMPARISON.some((row) => row.topic === "Seats"));
});

// About was a popup over the planner; it's a page of its own now (#/about),
// with what's checked and what isn't side by side.
test("About is a page, not a dialog", () => {
  assert.doesNotMatch(html, /role="dialog"/);
  assert.match(html, /<button[^>]*>← Back to RegCheck<\/button>/);
});

// The tour lives in the nav, which About shares, so About doesn't repeat it.
test("About has no tour button of its own", () => {
  assert.doesNotMatch(html, /Take the tour/);
});

test("About sets what's checked against what isn't, row by row", () => {
  assert.match(html, /<table class="about-compare"/);
  assert.equal((html.match(/<th class="topic" scope="row"/g) ?? []).length, COMPARISON.length);
  for (const row of COMPARISON) assert.ok(row.yes.length > 0 && row.no.length > 0, `${row.topic} needs both columns`);
});
