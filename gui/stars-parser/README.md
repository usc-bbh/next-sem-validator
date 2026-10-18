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

Milestones M0–M4 are built. The app imports `parseStarsReport` from
`index.js`, which re-exports `report.js`. Every upload goes through the review
screen (`gui/src/StarsReview.jsx`) before it reaches the validator. See the
design doc, §9–10.

## Layout

```
index.js         What the app imports: re-exports report.js and parse.js
report.js        Browser entry: parseStarsReport(file) → result or null
parse.js         parseStarsText(text) → result, or throws StarsParseError  (stages 3–6; runs in Node)
extract.js       Stage 1: pdf.js fragments (the pdf.js build is passed in)
layout.js        Stage 2: lines by baseline, fixed-width columns, sanity gates
clean.js         Stage 3: drop preamble, page furniture, web footer
blocks.js        Stage 4: split on dividers, label blocks from the anchor table
fields.js        Stage 5: course rows by column, transfer source, header fields
checks.js        Stage 6: hard checks and warnings
scripts/extract-fixture.mjs   Redacted PDF → fixtures/stars/<name>.txt
```

## Usage

In the app:

```js
import { parseStarsReport } from "./stars-parser";

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
