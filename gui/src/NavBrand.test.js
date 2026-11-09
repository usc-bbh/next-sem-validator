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
const { default: NavBrand } = await server.ssrLoadModule("/src/NavBrand.jsx");

// The logo used to link out to the BUAI Builder Hub site in a new tab.
test("the nav logo links to the RegCheck main page, in the same tab", () => {
  const html = renderToStaticMarkup(createElement(NavBrand, { onHome() {} }));
  assert.doesNotMatch(html, /bbh-website/);
  assert.doesNotMatch(html, /target="_blank"/);
  assert.match(html, /<a href="\/[^"]*" aria-label="RegCheck home"/);
  assert.match(html, />RegCheck<\/span><\/a>/); // the wordmark is part of the link
});
