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
  assert.match(html, /Your report isn&#x27;t uploaded anywhere\./);
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

test("the popup embeds the real form, with a new-tab link if the frame won't load", () => {
  const html = renderToStaticMarkup(createElement(FormPopup, { formUrl: FEEDBACK_FORM_URL, onClose() {} }));
  assert.match(html, /role="dialog"/);
  assert.match(html, new RegExp(`<iframe src="${esc(FEEDBACK_FORM_URL)}\\?embedded=true"`));
  assert.match(html, new RegExp(`<a href="${esc(FEEDBACK_FORM_URL)}"[^>]*>Open in a new tab ↗</a>`));
  assert.match(html, /aria-label="Close"/);
});

test("the page says the form goes to Google", () => {
  assert.match(render(), /The form is a Google Form, so what you type there goes to Google\./);
});
