import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCourses, getInstructors } from "./courseSearch.js";

const sec = (instructor) => ({ sections: { lectures: [{ instructor }] } });
const catalog = {
  "CSCI 104": { description: "Data structures and algorithms", ...sec("Mark Redekopp") },
  "CSCI 201": { description: "Principles of software development", ...sec("TBD") },
  "MATH 225": { description: "Linear algebra", ...sec("Ana Lopez") },
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`WRIT ${100 + i}`, { description: "Writing", ...sec("TBD") }])),
};

test("matches code (ignoring spaces and dashes), description and instructor", () => {
  assert.deepEqual(searchCourses(catalog, "csci-104").shown, ["CSCI 104"]);
  assert.deepEqual(searchCourses(catalog, "csci104").shown, ["CSCI 104"]);
  assert.deepEqual(searchCourses(catalog, "linear alg").shown, ["MATH 225"]);
  assert.deepEqual(searchCourses(catalog, "redekopp").shown, ["CSCI 104"]);
});

test("an empty or blank query says nothing", () => {
  for (const q of ["", "   "]) assert.deepEqual(searchCourses(catalog, q), { shown: [], more: 0, notFound: false, allAdded: false });
  assert.equal(searchCourses(null, "csci").notFound, false);
});

test("a query that matches nothing is notFound", () => {
  const r = searchCourses(catalog, "zzzz 999");
  assert.deepEqual(r.shown, []);
  assert.equal(r.notFound, true);
  assert.equal(r.allAdded, false);
});

test("truncated results report how many more there are", () => {
  const r = searchCourses(catalog, "writ");
  assert.equal(r.shown.length, 8);
  assert.equal(r.more, 4);
  assert.equal(r.notFound, false);
  assert.equal(searchCourses(catalog, "writ", [], 20).more, 0);
});

test("already-added courses are hidden and don't count as 'more'", () => {
  const added = ["WRIT 100", "WRIT 101"];
  const r = searchCourses(catalog, "writ", added);
  assert.ok(!r.shown.some((c) => added.includes(c)));
  assert.equal(r.more, 2); // 10 left, 8 shown
});

test("if every match is already added, it isn't 'not found'", () => {
  const r = searchCourses(catalog, "linear", ["MATH 225"]);
  assert.deepEqual(r, { shown: [], more: 0, notFound: false, allAdded: true });
});

test("getInstructors skips TBD and dedupes", () => {
  assert.deepEqual(getInstructors({ sections: { a: [{ instructor: "X" }, { instructor: "X" }], b: [{ instructor: "TBD" }] } }), ["X"]);
  assert.deepEqual(getInstructors(undefined), []);
});
