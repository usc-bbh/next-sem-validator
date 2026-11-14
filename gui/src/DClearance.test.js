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
const { DClearanceView, ClearanceLink, anchorId, matchesQuery, displayName, startsOpen } = await server.ssrLoadModule("/src/DClearance.jsx");
const rules = JSON.parse(readFileSync(new URL("../../analytics/data/dept_clearance.json", import.meta.url), "utf8"));
const render = (props = {}) => renderToStaticMarkup(createElement(DClearanceView, { rules, onBack() {}, ...props }));
const dept = (code) => rules.departments.find((d) => d.dept_code === code);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const html_ = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const schoolOf = (html, school) => html.match(new RegExp(`<details class="dc-school"[^>]*><summary[^>]*><h2[^>]*>${school}</h2>`))[0];
const sectionOf = (html, code) => html.match(new RegExp(`<section id="${anchorId(code)}"[\\s\\S]*?</section>`))[0];

// The D-clearance notice used to carry each department's whole entry. It's now
// one line, and the full steps live on this page.
test("the page lists every department with its summary and full steps", () => {
  const html = render();
  for (const d of rules.departments) {
    const section = sectionOf(html, d.dept_code);
    assert.ok(section.includes(`>${html_(d.summary)}<`), `${d.dept_code} summary`);
    assert.match(section, />Full steps</, d.dept_code);
  }
});

test("a department's section shows how to get it and links to where to request it", () => {
  const section = sectionOf(render(), "ENGL");
  assert.match(section, />Fill out the ENGL D-clearance Google Form\. All listed sections use the same form\.</);
  assert.match(section, new RegExp(`href="${esc(dept("ENGL").form_link)}"[^>]*>Where to request it ↗<`));
  assert.match(section, new RegExp(`href="${esc(dept("ENGL").source_url)}"[^>]*>Department&#x27;s page ↗<`));
});

test("the department a notice links to opens with its steps showing", () => {
  const html = render({ focus: "BUCO" });
  assert.match(sectionOf(html, "BUCO"), /aria-current="true"[\s\S]*<details open=""/);
  assert.doesNotMatch(sectionOf(html, "ENGL"), /aria-current|<details open/);
});

test("finding a department matches its course prefixes and name", () => {
  assert.ok(matchesQuery(dept("BUCO"), "dso")); // BUCO covers DSO
  assert.ok(matchesQuery(dept("CSCI"), " CSCI "));
  assert.ok(matchesQuery(dept("ENGL"), "english"));
  assert.ok(!matchesQuery(dept("ENGL"), "csci"));
  assert.ok(matchesQuery(dept("ENGL"), ""));
});

test("the page says the steps change and when they were last checked", () => {
  const html = render();
  assert.match(html, /change every semester/);
  assert.match(html, /Last checked August 10, 2026\./);
});

test("loading and failed states say so", () => {
  assert.match(render({ rules: null }), /Loading departments…/);
  assert.match(render({ rules: null, error: true }), /role="alert"[^>]*>The D-clearance steps didn&#x27;t load/);
});

test("a notice links to its department's steps, or to the whole page with none", () => {
  const link = (dept) => renderToStaticMarkup(createElement(ClearanceLink, { course: "DSO 488", dept, onOpen() {} }));
  assert.match(link("BUCO"), /<a href="#\/d-clearance\/BUCO"[^>]*>See the full steps →<\/a>/);
  assert.match(link(null), /<a href="#\/d-clearance"[^>]*>See every department&#x27;s steps →<\/a>/);
});

// Every school's departments sat open in one long page.
test("each school's section starts closed", () => {
  const html = render();
  for (const school of ["Dornsife", "Viterbi", "Marshall"]) assert.doesNotMatch(schoolOf(html, school), /open=""/, school);
});

test("the school holding the department a notice links to starts open", () => {
  const html = render({ focus: "BUCO" });
  assert.match(schoolOf(html, "Marshall"), /<details class="dc-school" open=""/);
  assert.doesNotMatch(schoolOf(html, "Dornsife"), /open=""/);
});

test("a search opens every school it matches", () => {
  assert.equal(startsOpen("Dornsife", null, "engl"), true);
  assert.equal(startsOpen("Dornsife", null, "  "), false);
  assert.equal(startsOpen("Marshall", "Marshall", ""), true);
});

// Names repeated the school ("English (Dornsife)") under the school's own heading.
test("department names drop the school in parentheses", () => {
  assert.equal(displayName(dept("ENGL")), "English");
  assert.equal(displayName(dept("BUCO")), "Business Communication");
  assert.equal(displayName(dept("ACCT")), "Accounting");
  assert.equal(displayName(dept("CSCI")), "Computer Science");
  assert.equal(displayName(dept("DORN")), "Other Dornsife departments"); // not just "Dornsife"
  const html = render();
  assert.match(sectionOf(html, "ENGL"), /<h3[^>]*>English<\/h3>/);
  for (const d of rules.departments) assert.doesNotMatch(displayName(d), new RegExp(`\\(${d.school}`), d.dept_code);
});
