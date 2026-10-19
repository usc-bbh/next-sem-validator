// Turns a redacted STARS PDF into a fixture: fixtures/stars/<name>.txt.
//
//   cd gui
//   node stars-parser/scripts/extract-fixture.mjs <report.pdf> <name>
//
// Runs stages 1–2 exactly as the app does, with pdf.js's Node build, and
// writes the text stage 3 onwards reads. Fails without writing anything if
// the layout sanity gates (STARS_PARSER_DESIGN.md §4) don't pass.
//
// Only ever run this on a report redacted with STARSRedacter. The redaction
// test (test/fixtures-redacted.test.js) fails on a fixture that leaks, but
// the safe habit is never to point this at a real report in the first place.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import { extractPages } from "../extract.js";
import { layout, layoutProblems } from "../layout.js";

const [pdfPath, name] = process.argv.slice(2);
if (!pdfPath || !name || !/^[a-z0-9_]+$/.test(name)) {
  console.error("usage: node stars-parser/scripts/extract-fixture.mjs <report.pdf> <name>");
  console.error("       <name> is lower_snake_case, e.g. aibiz_sr_minor");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../../fixtures/stars", `${name}.txt`);

const pages = await extractPages(pdfjsLib, new Uint8Array(fs.readFileSync(pdfPath)));
const text = layout(pages);
const problems = layoutProblems(text, pages.length);
if (problems.length) {
  console.error(`${pdfPath}: layout check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

fs.writeFileSync(out, text);
console.log(`${path.relative(process.cwd(), out)}: ${pages.length} pages, ${text.split("\n").length - 1} lines`);
