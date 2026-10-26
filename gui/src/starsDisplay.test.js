import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { gradeLabel, groupCompleted, isKnownGrade, termLabel, unitTotals } from "./starsDisplay.js";

const FIXTURES = new URL("../../fixtures/stars/", import.meta.url);
const fixtures = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => [f, JSON.parse(readFileSync(new URL(f, FIXTURES)))]);

test("term codes read as season and year", () => {
  assert.equal(termLabel("20222"), "Summer 2022");
  assert.equal(termLabel("20261"), "Spring 2026");
  assert.equal(termLabel("20263"), "Fall 2026");
  assert.equal(termLabel("99993"), "99993");
  assert.equal(termLabel(""), "");
});

test("every grade on the fixtures has words, except in-progress RG", () => {
  for (const [name, report] of fixtures) {
    for (const row of report.completedCourses) {
      assert.ok(isKnownGrade(row.grade), `${name}: ${row.code} grade ${row.grade}`);
    }
  }
  assert.equal(gradeLabel("TR"), "Transfer credit");
  assert.equal(gradeLabel("Lp"), "Passed, grade hidden");
  assert.equal(gradeLabel("ZZ"), "ZZ");
});

test("groups keep every row once, with its own index", () => {
  for (const [name, report] of fixtures) {
    const groups = groupCompleted(report.completedCourses);
    const indexes = groups.flatMap((g) => g.items.map((i) => i.index)).sort((a, b) => a - b);
    assert.deepEqual(indexes, report.completedCourses.map((_, i) => i), name);
    for (const g of groups) for (const { row, index } of g.items) assert.equal(report.completedCourses[index], row);
  }
});

test("semesters come first and in order; transfer credit is grouped by kind", () => {
  const rows = [
    { term: "20253", source: "usc" },
    { term: "20222", source: "exam" },
    { term: "", source: "usc" },
    { term: "20251", source: "usc" },
    { term: "20232", source: "transfer_generic" },
    { term: "20233", source: "transfer" },
  ];
  assert.deepEqual(groupCompleted(rows).map((g) => g.title), [
    "Spring 2025",
    "Fall 2025",
    "Added by you",
    "Exam credit (AP, IB)",
    "Transfer courses",
    "General transfer credit",
  ]);
});

test("the list's unit totals match every fixture report's own", () => {
  for (const [name, report] of fixtures) {
    if (!report.units) continue;
    const t = unitTotals(report);
    assert.equal(t.completed, t.earned, `${name} earned`);
    assert.equal(t.inProgress, t.reportInProgress, `${name} in progress`);
  }
});
