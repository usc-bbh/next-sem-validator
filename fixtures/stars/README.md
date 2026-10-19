# Shared STARS fixtures

These files sit on the seam between the **parser** (`gui/stars-parser/`,
JavaScript) and the **validator** (`analytics/`, Python). They are owned by
neither module so both can depend on them without a circular relationship.

The contract, per sample student:

```
<name>.txt     the report as text (the parser's stage 2 output)  — the parser's INPUT
<name>.json    the parsed report                                   — the parser's expected OUTPUT
                                                                     AND the validator's stars_summary INPUT
```

- The parser test (`gui/stars-parser/test/parse.test.js`) asserts that parsing
  `<name>.txt` produces exactly `<name>.json`.
- The validator test loads every `<name>.json` as its `stars_summary`.

Same bytes on both sides. If the parser's output shape drifts, a validator test
breaks immediately instead of surfacing as a broken app weeks later, and adding
one new sample student exercises both modules at once.

## Current contents

Eleven redacted undergraduate reports, each a `.txt` / `.json` pair, plus:

- `grad_apsy.txt`, a graduate report with no `.json`. The parser refuses it,
  and the test checks that it does.
- `mock_stars_report.json`, a hand-written stub kept for validator edge cases
  the real samples don't cover. It's in the old output shape and is updated
  at milestone M4 (`gui/stars-parser/STARS_PARSER_DESIGN.md` §11).

What each sample is in the set for is listed in the design doc, §10.

## Adding a sample

1. Redact the PDF with
   [STARSRedacter](https://huggingface.co/spaces/buai-builder-hub/STARSRedacter).
   Never commit a real report or anything extracted from one.
2. `cd gui && node stars-parser/scripts/extract-fixture.mjs <redacted.pdf> <name>`
   writes `<name>.txt`, and refuses if the layout checks fail.
3. `npm test`. `test/fixtures-redacted.test.js` fails if anything in the new
   `.txt` looks unredacted.
4. Write `<name>.json` and check it against the PDF by hand: every course,
   grade and unit count, the transfer rows and their `source`, and the header
   fields. Don't generate it and commit it unread; the point of the file is
   that a person has confirmed it.
