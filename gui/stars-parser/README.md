# STARS Parser

Reads a USC STARS degree progress report and returns the student's courses,
class level, GPA and the rest of the fields in
[`STARS_PARSER_DESIGN.md`](STARS_PARSER_DESIGN.md) §8.

**Supported input:** the STARS report printed to PDF from
`experience.usc.edu`, single column, with a text layer. Undergraduate only:
graduate reports are refused. Scanned copies and two-column printouts aren't
supported.

Everything runs client-side. Nothing is sent to a server.

## Status

The rebuilt parser (milestones M0–M3, plus the parser's half of M4) is in
this folder, but **the app doesn't use it yet**. `index.js` still exports the
old parser from `legacy/`. The switch happens at M4, in the same release as
the validator fixes and the review screen, so nothing new reaches students
before then. See the design doc, §10.

## Layout

```
report.js        Browser entry: parseStarsReport(file) → result or null   (M4 switches the app to this)
parse.js         parseStarsText(text) → result, or throws StarsParseError  (stages 3–6; runs in Node)
extract.js       Stage 1: pdf.js fragments (the pdf.js build is passed in)
layout.js        Stage 2: lines by baseline, fixed-width columns, sanity gates
clean.js         Stage 3: drop preamble, page furniture, web footer
blocks.js        Stage 4: split on dividers, label blocks from the anchor table
fields.js        Stage 5: course rows by column, transfer source, header fields
checks.js        Stage 6: hard checks and warnings
scripts/extract-fixture.mjs   Redacted PDF → fixtures/stars/<name>.txt
legacy/          The old parser, which the app still uses until M4
```

## Usage

From M4, in the app:

```js
import { parseStarsReport } from "./stars-parser/report.js";

const result = await parseStarsReport(file, {
  onStatus: (msg) => console.log(msg),
  onFailure: (err) => console.log(err.check, err.message), // StarsParseError
});
// result is null if the parse failed; the review screen opens empty.
```

On text, for tests and scripts:

```js
import { parseStarsText } from "./stars-parser/parse.js";
const result = parseStarsText(fs.readFileSync("fixtures/stars/aibiz_sr_minor.txt", "utf8"));
```

## Tests

```
cd gui
npm test
```

Node's built-in runner, nothing to install. The suite runs every stage
against hand-built inputs, checks that every `fixtures/stars/<name>.txt`
parses to exactly `<name>.json`, makes each hard check fail on a report
broken the way it guards against, and fails if any fixture looks unredacted.

To add a sample report, see [`fixtures/stars/README.md`](../../fixtures/stars/README.md).
