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
    const text = section.replace(/<[^>]+>/g, "");
    assert.ok(text.includes(html_(d.summary)), `${d.dept_code} summary`);
    assert.match(section, />Full steps</, d.dept_code);
  }
});

test("a department's section shows how to get it and links to where to request it", () => {
  const section = sectionOf(render(), "ENGL");
  assert.match(section, /<dt>How to get it<\/dt><dd><ul><li>Fill out the ENGL D-clearance Google Form\.<\/li><li>All listed sections use the same form\.<\/li><\/ul>/);
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
  assert.equal(displayName(dept("IYA")), "Iovine and Young Academy"); // its name is its school's, but it isn't a fallback
  const html = render();
  assert.match(sectionOf(html, "ENGL"), /<h3[^>]*>English<\/h3>/);
  for (const d of rules.departments) assert.doesNotMatch(displayName(d), new RegExp(`\\(${d.school}`), d.dept_code);
});

// The page said only that departments differ. It now walks through the process
// every department shares, before the department list.
test("the page explains how D-clearance works, step by step", () => {
  const html = render();
  assert.match(html, /<h2 id="dc-how"[^>]*>How it works<\/h2>/);
  const steps = [...html.matchAll(/<li><span><b[^>]*>([^<]+)<\/b>/g)].map((m) => m[1]);
  assert.deepEqual(steps, [
    "Find the sections that need it.",
    "Request it from the department.",
    "Wait for approval.",
    "Register in WebReg yourself.",
  ]);
  assert.match(html, /five-digit section number and your USC ID/);
  assert.match(html, /My Info &gt; Cleared Sections/);
  assert.match(html, /doesn&#x27;t hold a seat/);
  assert.match(html, /isn&#x27;t a prerequisite waiver/);
  assert.ok(html.indexOf("How it works") < html.indexOf('class="dc-school"'), "steps come before the departments");
});

// The full steps were one paragraph per field, and the addresses in them were plain text.
test("full steps break each case into its own point, with the case in bold", () => {
  const section = sectionOf(render(), "CSCI");
  assert.match(section, /<dd><div[^>]*>The process depends on your major:<\/div><ul><li><b[^>]*>Declared CSCI majors: <\/b>/);
  assert.match(section, /<b[^>]*>BUAI majors, partner\/joint program majors, Pre-Engineering, and Pre-CS students: <\/b>[^<]*<ul><li>/); // its other sentences are sub-points
});

test("emails, web addresses and phone numbers in the steps are links", () => {
  const section = sectionOf(render(), "BUCO");
  assert.match(section, /<a href="mailto:undergrad\.advising@marshall\.usc\.edu">undergrad\.advising@marshall\.usc\.edu<\/a>/);
  assert.match(section, /<a href="tel:2137400690">213-740-0690<\/a>/);
  const csci = sectionOf(render(), "CSCI");
  assert.match(csci, /<a href="https:\/\/myviterbi\.usc\.edu" title="https:\/\/myviterbi\.usc\.edu" target="_blank" rel="noopener noreferrer">myviterbi\.usc\.edu<\/a>/);
});

test("the most useful rows come first", () => {
  const labels = [...sectionOf(render(), "BUCO").matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["How to get it", "Contact", "Turnaround", "Which courses", "Priority", "Tips"]);
});
