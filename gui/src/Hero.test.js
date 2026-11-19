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
const { default: Hero } = await server.ssrLoadModule("/src/Hero.jsx");
const text = renderToStaticMarkup(createElement(Hero)).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const about = readFileSync(new URL("./About.jsx", import.meta.url), "utf8");

// The home page listed what RegCheck checks but never said what goes wrong
// without it.
test("the home page says what problem RegCheck solves, then how", () => {
  assert.match(text, /Validate your next-semester schedule before you register\./);
  assert.match(text, /You don't find out your schedule is broken until WebReg rejects it mid-registration/);
  assert.match(text, /By then your spot is gone\./);
  assert.match(text, /Upload your STARS report and the sections you're planning to take\./);
  assert.ok(text.indexOf("WebReg rejects") < text.indexOf("Upload your STARS report"), "problem before solution");
  assert.match(app, /<Hero \/>/);
});

// RegCheck doesn't check open seats, and About says so. The home page mustn't
// promise it, or promise to catch everything.
test("the home page promises nothing About says RegCheck doesn't check", () => {
  assert.match(about, /Open seats: a section you pick may be full/);
  assert.doesNotMatch(text, /full section|seat|everything/i);
});
