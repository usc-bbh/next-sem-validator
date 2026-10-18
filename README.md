# RegCheck (next-sem-validator)

Pick sections for next semester, upload a STARS report, and check the schedule
before registering. Live at https://usc-bbh.github.io/next-sem-validator/.

Everything runs in the student's browser: the STARS PDF is parsed client-side
and the Python validator runs through Pyodide. No report is sent to a server.

**Owner:** Tanzil Hussain, for the STARS parser, the validator, and the app.

## Layout

```
.
├── gui/                 Web app (React + Vite), the part deployed to Pages
│   ├── src/App.jsx          Schedule builder + validator UI
│   ├── src/StarsReview.jsx  Review screen between upload and validation
│   ├── stars-parser/        Client-side STARS PDF parser (the app is its only user)
│   ├── pyodide_bridge.js    Runs the Python validator in the browser via Pyodide
│   └── public/validator/    Generated at dev/build time from analytics/, not committed
│
├── analytics/           Validation logic (Python)
│   ├── validate_next_semester.py   Pure function: (planned, stars, catalog, clearance) -> result
│   ├── data/                       D-clearance reference data + its sources
│   ├── test/                       pytest suite + catalog/planned-course fixtures
│   └── README.md                   Input/output schema contract
│
├── fixtures/stars/      Redacted sample reports: parser input (.txt) and expected output (.json)
└── .github/workflows/   deploy.yml: builds gui/ and publishes it to Pages
```

`analytics/` is the only copy of the validator. `npm run dev` and
`npm run build` copy `analytics/validate_next_semester.py` into
`gui/public/validator/`, so the page always runs the current Python.

This repo is the only home of the STARS parser (`gui/stars-parser/`) and the
validator (`analytics/`), so fix both here. Neither has a copy in
[bbh-course-reg-project](https://github.com/usc-bbh/bbh-course-reg-project)
any more. The parser may move back there if the bbh degree planner starts
using it. `fixtures/stars/` is still mirrored in bbh.
[Constellation](https://github.com/usc-bbh/constellation) is a separate STARS
viewer with its own parser today. The parser's requirement-tree output (M5) is
being built from Constellation's shape, so Constellation could later import
this parser instead.

## Run the app

```bash
cd gui
npm install
npm run dev
```

## Test

**Validator:**

```bash
python3 -m pip install -r analytics/requirements-dev.txt  # first time only
python3 -m pytest analytics/test/
```

**Parser** (Node's built-in test runner, nothing to install):

```bash
cd gui
npm test
```

## The parser rebuild

The parser was rebuilt in October 2026. The design, the reasons behind it, and the
milestones are in
[`gui/stars-parser/STARS_PARSER_DESIGN.md`](gui/stars-parser/STARS_PARSER_DESIGN.md).
The new parser is built and tested on 11 redacted reports. After every
upload the student sees a review screen with what was read, can correct it,
and confirms it before validating.

## Deploy

Pushing to `main` deploys. The **Deploy to GitHub Pages** workflow builds
`gui/` and publishes `gui/dist` to Pages. It needs no secrets. To redeploy
without a new commit, run the workflow manually from the Actions tab.

## Schemas

| What | Documented in |
|---|---|
| Validator input and output, including the `stars_summary` it reads from the parser | [`analytics/README.md`](analytics/README.md) |
| Parser output | [`gui/stars-parser/STARS_PARSER_DESIGN.md`](gui/stars-parser/STARS_PARSER_DESIGN.md) §8 |
| Shared fixture pairs (`<name>.txt` parser input, `<name>.json` parser output and validator input) | [`fixtures/stars/README.md`](fixtures/stars/README.md) |

## STARS reports and privacy

Never commit a real STARS report or anything extracted from one. Reports
identify the student and contain their grades.

Redact a report before using it as a fixture or sharing it. The redaction tool
is [STARSRedacter](https://huggingface.co/spaces/buai-builder-hub/STARSRedacter).
It removes the name, ID, address and sport, and replaces each grade with a
pass/fail token (`Lp`, `Lf`, `Pp`, `Pn`) and each GPA with `X.XXX`. The parser
has to handle those tokens, since every committed fixture is redacted.
