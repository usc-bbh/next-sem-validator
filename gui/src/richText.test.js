import { test } from "node:test";
import assert from "node:assert/strict";
import { toPoints, splitLabel, sentences, listItems, linkify, shortUrl } from "./richText.js";

test("numbered cases become points, with the lead-in kept apart", () => {
  assert.deepEqual(toPoints("Depends on the course: (1) PSYC 290: apply. (2) PSYC 314: email a@usc.edu."), {
    intro: "Depends on the course:",
    points: ["PSYC 290: apply.", "PSYC 314: email a@usc.edu."],
  });
});

test("a list split by bars becomes points", () => {
  assert.deepEqual(toPoints("Email the professor for your section: WRIT 320: a@usc.edu | WRIT 340: b@usc.edu"), {
    intro: "Email the professor for your section:",
    points: ["WRIT 320: a@usc.edu", "WRIT 340: b@usc.edu"],
  });
});

test("plain prose is split into sentences, not at abbreviations", () => {
  assert.deepEqual(sentences("Contact that department (e.g. MATH 245, PHYS 153). Then wait."),
    ["Contact that department (e.g. MATH 245, PHYS 153).", "Then wait."]);
  assert.deepEqual(toPoints(""), { intro: null, points: [] });
});

test("a short lead-in before a colon is a point's label", () => {
  assert.deepEqual(splitLabel("Declared CSCI majors: submit on myViterbi."), ["Declared CSCI majors:", "submit on myViterbi."]);
  assert.deepEqual(splitLabel("Submit it. Then: wait."), [null, "Submit it. Then: wait."]);
});

test("only a long comma list is split into items, never inside parentheses", () => {
  assert.equal(listItems("A, B, C, D, E"), null);
  const long = Array.from({ length: 12 }, (_, i) => `ACAD ${100 + i} (Design, Part ${i})`).join(", ") + ", and ACAD 499 (Special Topics).";
  const items = listItems(long);
  assert.equal(items.length, 13);
  assert.equal(items[0], "ACAD 100 (Design, Part 0)");
  assert.equal(items[12], "ACAD 499 (Special Topics)");
});

test("emails, web addresses and phone numbers become links, minus sentence punctuation", () => {
  assert.deepEqual(linkify("Email a.b@usc.edu or visit myviterbi.usc.edu. Call (213) 740-1460."), [
    { text: "Email " }, { text: "a.b@usc.edu", href: "mailto:a.b@usc.edu" },
    { text: " or visit " }, { text: "myviterbi.usc.edu", href: "https://myviterbi.usc.edu" },
    { text: ". Call " }, { text: "(213) 740-1460", href: "tel:2137401460" }, { text: "." },
  ]);
  assert.deepEqual(linkify("See https://forms.gle/abc"), [{ text: "See " }, { text: "https://forms.gle/abc", href: "https://forms.gle/abc" }]);
  assert.deepEqual(linkify("No links here"), [{ text: "No links here" }]);
});

test("a long address is shortened for display", () => {
  assert.equal(shortUrl("dornsife.usc.edu/dash/d-clearance-info/"), "dornsife.usc.edu/dash/d-clearance-info");
  assert.equal(shortUrl("https://ngp.usc.edu/faculty/directory/neuroscience-labs/"), "ngp.usc.edu/…");
  assert.equal(shortUrl("https://drive.google.com/file/d/1BfGj7SAb6Zb_VE1iCC_6BuOl1AoXXYyS/view"), "Google Drive file");
  assert.equal(shortUrl("docs.google.com/forms/d/e/1FAIpQLSc/viewform"), "Google Form");
  assert.equal(shortUrl("forms.gle/USKeugYMSBNV67Gc8"), "Google Form");
});
