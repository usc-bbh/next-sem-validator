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
const { default: About } = await server.ssrLoadModule("/src/About.jsx");
const html = renderToStaticMarkup(createElement(About, { onClose() {}, onTour() {} }));
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
