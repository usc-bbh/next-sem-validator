# next-sem-validator

Pick sections for next semester, upload a STARS report, and check the schedule
before registering. Live at https://usc-bbh.github.io/next-sem-validator/.

## Layout

```
.
├── gui/                 Web app (React + Vite) — what gets deployed to Pages
│   ├── src/App.jsx          Schedule builder + validator UI
│   ├── stars-parser/        Client-side STARS PDF parser (the GUI is its only consumer)
│   ├── pyodide_bridge.js    Runs the Python validator in the browser via Pyodide
│   └── public/validator/    Generated at dev/build time from analytics/ — not committed
│
├── analytics/           Validation logic (Python)
│   ├── validate_next_semester.py   Pure function: (planned, stars, catalog, clearance) -> result
│   ├── data/                       D-clearance reference data + its sources
│   ├── test/                       pytest suite + catalog/planned-course fixtures
│   └── README.md                   Input/output schema contract
│
└── fixtures/stars/      STARS summaries shared by the parser and the validator
```

`analytics/` is the single source for the validator. `npm run dev` and
`npm run build` copy `analytics/validate_next_semester.py` into
`gui/public/validator/`, so the page always runs the current Python.

The validator, its data, and `fixtures/stars/` mirror `validator/` and
`fixtures/stars/` in
[bbh-course-reg-project](https://github.com/tanzilhussain/bbh-course-reg-project).

## Run the app

```bash
cd gui
npm install
npm run dev
```

## Test the validator

```bash
python3 -m pip install -r analytics/requirements-dev.txt  # first time only
python3 -m pytest analytics/test/
```
