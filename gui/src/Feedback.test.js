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
const { default: Feedback, FormPopup, embedUrl, FEEDBACK_FORM_URL } = await server.ssrLoadModule("/src/Feedback.jsx");
const render = (props = {}) => renderToStaticMarkup(createElement(Feedback, { onBack() {}, ...props }));
const esc = (s) => s.replace(/[.?/]/g, "\\$&");

test("a form's share link gets embedded=true, keeping what it had", () => {
  const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform";
  assert.equal(embedUrl(FORM), `${FORM}?embedded=true`);
  assert.equal(embedUrl(`${FORM}?usp=sf_link`), `${FORM}?usp=sf_link&embedded=true`);
  assert.equal(embedUrl(""), "");
});

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

// The form opens in a popup on the page, not a new tab.
test("step 2's button opens the form in a popup, not straight away", () => {
  const html = render();
  assert.match(html, /<button[^>]*>Report an issue<\/button>/);
  assert.doesNotMatch(html, /<iframe/);
});

// The form takes file uploads, so Google requires sign-in, which can't happen in
// a frame; the popup has to give a way out for browsers that show sign-in there.
test("the popup embeds the real form and says to open it in a new tab if asked to sign in", () => {
  const html = renderToStaticMarkup(createElement(FormPopup, { formUrl: FEEDBACK_FORM_URL, onClose() {} }));
  assert.match(html, /role="dialog"/);
  assert.match(html, new RegExp(`<iframe src="${esc(FEEDBACK_FORM_URL)}\\?embedded=true"`));
  assert.match(html, /Asked to sign in\? Google doesn&#x27;t allow signing in here\./);
  assert.match(html, new RegExp(`<a href="${esc(FEEDBACK_FORM_URL)}"[^>]*>Open the form in a new tab ↗</a>`));
  assert.match(html, /aria-label="Close"/);
});

test("both steps say to attach the redacted copy, never the original", () => {
  const html = render();
  assert.match(html, /attach the redacted\s+copy in step 2/);
  assert.match(html, /attach your redacted report from step 1/);
  assert.match(html, /Attach only the redacted copy, never the original\./);
});

test("the page says the form goes to Google", () => {
  assert.match(render(), /The form is a Google Form, so what you send goes to Google/);
});
