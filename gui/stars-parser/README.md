# STARS Parser

Reads a USC STARS degree progress report and returns the student's courses,
class level and GPA for the validator.

**Supported input:** the STARS report printed to PDF from
`experience.usc.edu`, single column, with a text layer. Scanned copies and
two-column printouts aren't supported.

Everything runs client-side. Nothing is sent to a server.

The parser is being rebuilt. The design, and the reasons for it, are in
[`STARS_PARSER_DESIGN.md`](STARS_PARSER_DESIGN.md). Until milestone M4 the
app uses the current parser, which now lives in `legacy/`.

## Usage

```js
import { parseStarsReport } from "./stars-parser";

const result = await parseStarsReport(file, {
  onStatus: (msg) => console.log(msg),
});

if (!result) {
  // no text could be read from the PDF
}
```

## Tests

```
cd gui
node --test stars-parser/legacy/test/lineRebuilder.test.js
```
