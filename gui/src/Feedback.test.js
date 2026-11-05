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
const { default: Feedback, embedUrl } = await server.ssrLoadModule("/src/Feedback.jsx");
const render = (formUrl) => renderToStaticMarkup(createElement(Feedback, { onBack() {}, formUrl }));

const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform";

test("a form's share link gets embedded=true, keeping what it had", () => {
  assert.equal(embedUrl(FORM), `${FORM}?embedded=true`);
  assert.equal(embedUrl(`${FORM}?usp=sf_link`), `${FORM}?usp=sf_link&embedded=true`);
  assert.equal(embedUrl(""), "");
});

test("the page embeds the form and links it for when the frame won't load", () => {
  const html = render(FORM);
  assert.match(html, new RegExp(`<iframe src="${FORM.replace(/[.?/]/g, "\\$&")}\\?embedded=true"`));
  assert.match(html, new RegExp(`<a href="${FORM.replace(/[.?/]/g, "\\$&")}"`));
});

test("with no form yet, the page says so instead of showing an empty frame", () => {
  const html = render("");
  assert.doesNotMatch(html, /<iframe/);
  assert.match(html, /isn&#x27;t set up yet/);
});

// What's sent goes to Google, so the page says so.
test("the page says the form goes to Google and the report stays put", () => {
  const html = render(FORM);
  assert.match(html, /This form is a Google Form, so what you send goes to Google\./);
  assert.match(html, /Your STARS report never leaves your device/);
});
