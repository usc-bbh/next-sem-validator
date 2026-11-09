import { test, after } from "node:test";
import assert from "node:assert/strict";
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
const { default: Feedback, FEEDBACK_FORM_URL } = await server.ssrLoadModule("/src/Feedback.jsx");
const render = (props = {}) => renderToStaticMarkup(createElement(Feedback, { onBack() {}, ...props }));
const esc = (s) => s.replace(/[.?/]/g, "\\$&");

// Students with an issue are sent to redact their report first, on this page,
// rather than off to the hosted STARS Redactor.
test("step 1 redacts the report on the page, not on another site", () => {
  const html = render();
  assert.match(html, /Having an issue with a result\?/);
  assert.match(html, /Redact your STARS report/);
  assert.match(html, />Choose your STARS PDF</);
  assert.match(html, /nothing is uploaded/);
  assert.doesNotMatch(html, /huggingface/);
});

test("with a report already uploaded to RegCheck, step 1 offers to redact that one", () => {
  const html = render({ reportPdfUrl: "blob:report" });
  assert.match(html, />Redact the report you uploaded</);
  assert.match(html, />Choose a different PDF</);
});

// The form opens in a new tab: it takes a file upload, so Google asks the
// student to sign in, which a popup on the page couldn't do.
test("Report an issue opens the real form in a new tab, with no popup", () => {
  const html = render();
  assert.match(html, new RegExp(`<a href="${esc(FEEDBACK_FORM_URL)}" target="_blank" rel="noopener noreferrer"[^>]*>Report an issue ↗</a>`));
  assert.doesNotMatch(html, /<iframe|role="dialog"/);
});

test("both steps say to attach the redacted copy", () => {
  const html = render();
  assert.match(html, /attach the redacted\s+copy in step 2/);
  assert.match(html, /attach your redacted report from step 1/);
});

// The note under the button about Google sign-in and attaching only the
// redacted copy was taken out.
test("there's no Google Form note under the Report an issue button", () => {
  const html = render();
  assert.doesNotMatch(html, /The form is a Google Form/);
  assert.doesNotMatch(html, /never the original/);
});
