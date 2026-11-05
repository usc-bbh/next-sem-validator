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
const { default: About, ResultsDisclaimer } = await server.ssrLoadModule("/src/About.jsx");
const html = renderToStaticMarkup(createElement(About, { onClose() {} }));
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
test("About's limits list says grade minimums aren't checked", () => {
  assert.match(html, /Does <b>not<\/b> check minimum grades in prerequisites/);
});

test("About's limits list says a double major's second report isn't read", () => {
  assert.match(html, /Does <b>not<\/b> read a second STARS report/);
});

// The results read as a verdict, with nothing saying they're a best guess (#10).
test("the results disclaimer says it isn't an official check and links to the limits", () => {
  const note = renderToStaticMarkup(createElement(ResultsDisclaimer, { onShowLimits() {} }));
  assert.match(note, /role="note"/);
  assert.match(note, /<b>Not an official check\.<\/b>/);
  assert.match(note, /Confirm with your advisor and on WebReg before you register\./);
  assert.match(note, /<button[^>]*>What RegCheck doesn&#x27;t check<\/button>/);
});

test("the disclaimer's button opens the limits", () => {
  let opened = 0;
  const el = ResultsDisclaimer({ onShowLimits: () => opened++ });
  const button = [el.props.children].flat().find((c) => c?.type === "button");
  button.props.onClick();
  assert.equal(opened, 1);
});

// The tour moved out of About onto the main page, next to the steps it walks through.
test("About has no tour button", () => {
  assert.doesNotMatch(html, /Take the tour/);
  assert.match(html, /<button[^>]*>Got it<\/button>/);
});
