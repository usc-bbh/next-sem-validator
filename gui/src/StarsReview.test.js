import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});
after(() => server.close());
const { default: StarsReview, StarsSideBySide } = await server.ssrLoadModule("/src/StarsReview.jsx");
const { EMPTY_REPORT } = await server.ssrLoadModule("/src/emptyReport.js");
const report = JSON.parse(readFileSync(new URL("../../fixtures/stars/mock_stars_report.json", import.meta.url), "utf8"));
const failure = { check: "uncollectedRows", message: "Spring 2025 CSCI 104 is listed under \"X\" but isn't in the course list." };
const noop = () => {};
const dialog = (props) => renderToStaticMarkup(createElement(StarsReview, { onConfirm: noop, onCancel: noop, onSkip: noop, ...props }));
const side = (props) => renderToStaticMarkup(createElement(StarsSideBySide, { pdfUrl: "blob:x", onConfirm: noop, onCancel: noop, onSkip: noop, ...props }));
const SKIP = />Continue without your report</;

// A report that didn't parse left one way forward: retype every course.
test("after a failed parse, the student can continue without the report", () => {
  for (const render of [dialog, side]) {
    const html = render({ initial: EMPTY_REPORT, mode: "failed", failure });
    assert.match(html, SKIP);
    assert.match(html, /Or continue without your report: your schedule is still checked, but not prerequisites, courses you&#x27;ve already taken, class standing, GPA minimums and major restrictions\./);
  }
});

test("a report that parsed doesn't offer to skip it", () => {
  assert.doesNotMatch(dialog({ initial: report, mode: "parsed", failure: null }), SKIP);
  assert.doesNotMatch(side({ initial: report, mode: "parsed", failure: null }), SKIP);
});

// The App wires the button up and lets courses be picked without a report.
test("the page lets a student continue without a report, from the upload card or a failed parse", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.equal(app.match(/onSkip=\{continueWithoutReport\}/g).length, 2);
  assert.match(app, /starsSource === "none" && \(\s*<button onClick=\{continueWithoutReport\}[^>]*>Continue without a report<\/button>/);
  assert.match(app, /\{\(starsReport \|\| noReport\) && \(\s*<div className="layout"/);
  assert.match(app, /setStarsSource\("skipped"\)/);
});
