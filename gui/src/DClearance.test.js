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
  const html = render({ focus: "BUAD" });
  assert.match(sectionOf(html, "BUAD"), /aria-current="true"[\s\S]*<details open=""/);
  assert.doesNotMatch(sectionOf(html, "ENGL"), /aria-current|<details open/);
});

test("finding a department matches its course prefixes and name", () => {
  assert.ok(matchesQuery(dept("BUAD"), "dso")); // the Marshall entry covers DSO
  assert.ok(!matchesQuery(dept("BUCO"), "dso")); // Business Communication doesn't
  assert.ok(matchesQuery(dept("CSCI"), " CSCI "));
  assert.ok(matchesQuery(dept("ENGL"), "english"));
  assert.ok(!matchesQuery(dept("ENGL"), "csci"));
  assert.ok(matchesQuery(dept("ENGL"), ""));
});

test("the page says the steps change and when they were last checked", () => {
  const html = render();
  assert.match(html, /change them every semester/);
  assert.match(html, /Last checked August 10, 2026\./);
});

// The page said only to check the department's page. Students see a new
// requirement before we do, so it now says the steps may be out of date and
// links the feedback form to send one in.
test("the page warns the steps may be out of date and links the form to report a new requirement", async () => {
  const { FEEDBACK_FORM_URL } = await server.ssrLoadModule("/src/Feedback.jsx");
  const note = render().match(/<div role="note"[\s\S]*?Last checked[^<]*<\/div>/)?.[0];
  assert.ok(note, "a notice, before the departments");
  assert.match(note, /These steps may be out of date\./);
  assert.match(note, /Departments change them every semester/);
  assert.match(note, new RegExp(`See a new requirement\\? <a href="${esc(FEEDBACK_FORM_URL)}" target="_blank" rel="noopener noreferrer"[^>]*>Tell us ↗</a>`));
  assert.ok(render().indexOf('role="note"') < render().indexOf('class="dc-school"'));
});

// The intro, steps, notes and notice ran to 275 words before the first
// department. They're now about half that.
test("the explainer before the departments stays short", () => {
  const html = render();
  const words = html.slice(html.indexOf("<h1"), html.indexOf('type="search"')).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 150, `${words.length} words before the departments`);
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
  const html = render({ focus: "BUAD" });
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
  assert.equal(displayName(dept("BUAD")), "Marshall School of Business");
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
  assert.match(html, /Find yours below\. Some clear their majors at advising appointments\./);
  assert.doesNotMatch(html, /Include the course, the five-digit section number and your USC ID/); // removed: each department's steps say what to send
  assert.match(html, /My Info &gt; Cleared Sections/);
  assert.match(html, /doesn&#x27;t hold a seat, except GE office clearances/);
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
  const section = sectionOf(render(), "BUAD");
  assert.match(section, /<a href="mailto:undergrad\.advising@marshall\.usc\.edu">undergrad\.advising@marshall\.usc\.edu<\/a>/);
  assert.match(section, /<a href="tel:2137400690">213-740-0690<\/a>/);
  const csci = sectionOf(render(), "CSCI");
  assert.match(csci, /<a href="https:\/\/myviterbi\.usc\.edu" title="https:\/\/myviterbi\.usc\.edu" target="_blank" rel="noopener noreferrer">myviterbi\.usc\.edu<\/a>/);
});

test("the most useful rows come first", () => {
  const labels = [...sectionOf(render(), "BUAD").matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["How to get it", "Contact", "Turnaround", "Which courses", "Priority", "Tips"]);
});

// The Business Communication card listed FBE, DSO, MOR and MKT. They're Marshall-wide.
test("Marshall's prefixes sit on the Marshall card, and Business Communication shows only BUCO", () => {
  const chips = (code) => [...sectionOf(render(), code).matchAll(/<span class="mono"[^>]*>([A-Z]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(chips("BUCO"), ["BUCO"]);
  assert.deepEqual(chips("BUAD"), ["BUAD", "FBE", "DSO", "MOR", "MKT"]);
  assert.match(sectionOf(render(), "BUAD"), /<h3[^>]*>Marshall School of Business<\/h3>/);
  assert.match(sectionOf(render(), "BUAD"), /DSO 488 \(BUAI students only\)/);
});
