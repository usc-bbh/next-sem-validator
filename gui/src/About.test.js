import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
// "#/d-clearance" is RegCheck's own D-clearance page. USC's Advising & Support
// page, which lists every school's advising office, was checked November 17, 2026.
const CHECKED_LINKS = ["#/d-clearance", "https://www.usc.edu/advising-support/"];

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
  assert.match(html, /Need <a href="#\/d-clearance"[^>]*>D-clearance<\/a>\?<\/b><\/div>/); // the question alone, no "Reach out to your department."
  assert.doesNotMatch(html, /Reach out to your department/);
  assert.match(html, /For advising, reach out to your <a href="https:\/\/www\.usc\.edu\/advising-support\/" target="_blank" rel="noopener noreferrer"[^>]*>academic advisor<\/a>\./);
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

// "D-clearance" on About was plain text; each mention now opens the D-clearance page.
test("every mention of D-clearance links to the D-clearance page", () => {
  const mentions = html.replace(/<[^>]+>/g, (tag) => (tag.startsWith('<a href="#/d-clearance"') ? "[" : tag === "</a>" ? "]" : ""));
  const all = mentions.match(/\[?D-clearance\]?/g);
  assert.ok(all.length >= 2, `found ${all.length}`);
  for (const m of all) assert.equal(m, "[D-clearance]");
});

// Every claim About makes is tested end to end in analytics/test/test_about_claims.py
// (and, for what only the page does, here in gui/src). about_claims.json maps each claim to
// its tests; a new or reworded claim fails here until its tests are named.
const claimsFile = new URL("../../analytics/test/about_claims.json", import.meta.url);
const claims = JSON.parse(readFileSync(claimsFile, "utf8"));
const plain = (node) => renderToStaticMarkup(createElement("span", null, node))
  .replace(/<[^>]+>/g, "")
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

test("every claim on About is tested, and every tested claim is on About", () => {
  const onPage = { checks: COMPARISON.flatMap((r) => r.yes).map(plain), does_not_check: COMPARISON.flatMap((r) => r.no).map(plain) };
  for (const side of ["checks", "does_not_check"]) {
    assert.deepEqual([...onPage[side]].sort(), Object.keys(claims[side]).sort(), `About's "${side}" column and about_claims.json differ`);
    for (const [claim, refs] of Object.entries(claims[side])) assert.ok(refs.length > 0, `no test for: ${claim}`);
  }
});

test("each test a claim names exists", () => {
  const python = readFileSync(new URL("../../analytics/test/test_about_claims.py", import.meta.url), "utf8");
  for (const refs of [...Object.values(claims.checks), ...Object.values(claims.does_not_check)]) {
    for (const ref of refs) {
      if (ref.startsWith("python:")) {
        assert.ok(python.includes(`def ${ref.slice(7)}(`), `missing Python test ${ref}`);
      } else {
        const [, file, title] = ref.match(/^js:([^:]+):(.+)$/) ?? [];
        assert.ok(file, `bad reference ${ref}`);
        const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
        assert.ok(source.includes(`test(${JSON.stringify(title)}`) || source.includes(`test("${title}"`), `missing ${file} test "${title}"`);
      }
    }
  }
});
