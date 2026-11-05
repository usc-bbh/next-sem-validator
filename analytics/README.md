# Next-Semester Validator (Module 4B)

Checks a student's planned courses against a STARS summary, the course
catalog, and USC department D-clearance rules. Owned by Tanzil.

```python
def validate_next_semester(
    planned_courses: list[dict],
    stars_summary: dict,
    course_catalog: dict,
    dept_clearance: dict,
) -> ValidationResult
```

## Input schemas

This section documents what the validator reads/assumes from each input. The
validator does not own these schemas (except `dept_clearance`) — it documents
its assumptions so upstream producers (the STARS parser, Agastya's catalog
scrape) can be checked against them, per the schema-contract discussion.

### `planned_courses`

A list where each item names the exact sections the student intends to
register for:

```json
{ "course": "CSCI 104", "sections": ["29903", "30119"] }
```

Sections are **required**, not optional — a plain course code string raises
`ValueError`. The goal of this module is to catch what would make a real
WebReg registration attempt fail, and WebReg itself requires a specific
section, so there's no useful "check this course, no section chosen" state.
All of a course's selected sections (e.g. a lecture and its lab) are treated
as simultaneous commitments, not alternatives to choose between.

### `stars_summary`

**Not the full STARS parser output** — only a slice of it. The full shape is
in `gui/stars-parser/STARS_PARSER_DESIGN.md` §8. This validator only reads the
fields below; it does not assume any other STARS field is present:

```json
{
  "major": "Computer Science",
  "classLevel": "Junior",
  "gpa": null,
  "completedCourses": [
    { "code": "CSCI 104", "grade": "Lp", "passed": true, "source": "usc", "origin": "parsed" },
    { "code": "CMPR 120", "grade": "TR", "passed": true, "source": "transfer", "origin": "parsed" },
    { "code": "MATH 226", "grade": "W", "passed": false, "source": "usc", "origin": "parsed" }
  ],
  "inProgressCourses": [
    { "code": "CSCI 350", "source": "usc" }
  ],
  "equivalents": [{ "from": "CMPR 120", "to": "CSCI 113" }],
  "waivedCourses": ["DSCI 281"]
}
```

| Field | Type | Used by |
|---|---|---|
| `major` | `string` | major-restrictions check (best-effort keyword match) |
| `classLevel` | `"Freshman" \| "Sophomore" \| "Junior" \| "Senior"` | class-standing check, major-restrictions undergrad/grad check |
| `gpa` | `number \| null` | prereq check (GPA thresholds). `null` (redacted or missing) makes a GPA threshold a warning, not a fail. |
| `completedCourses[].code` | `string` | already-taken check, prereq check |
| `completedCourses[].passed` | `boolean`, default `true` | `false` (a `W`, a failing grade, deleted credit) proves nothing: not taken, not a prerequisite |
| `completedCourses[].source` | `"usc" \| "exam" \| "transfer" \| "transfer_generic"`, default `"usc"` | only `usc` rows prove a course by their code; the others prove one only through `equivalents` |
| `completedCourses[].origin` | `"parsed" \| "student"`, default `"parsed"` | a prerequisite met only by a `student` row (added or edited on the review screen) is a warning, not a pass |
| `inProgressCourses[].code` | `string` | already-taken check (only `usc` rows) |
| `equivalents[]` | `{from, to}` | a passed row with code `from` proves `to` (from `RE - SUB … FOR …` on the report) |
| `waivedCourses[]` | `string` | a prerequisite met only by a waiver is a warning |

The defaults mean a summary without the newer fields is read the way every
row was read before they existed: as a passed USC course from the report.

### `course_catalog`

Accepts either `{"term": "20263", "courses": {code: entry}}` or a flat
`{code: entry}` dict. **Agastya owns this schema** (he owns the scrape) — the
table below is only what the validator reads from it today.

```json
{
  "units": 4,
  "description": "Course description text, sometimes containing prereq/restriction language.",
  "has_d_clearance": true,
  "has_restrictions": true,
  "has_lab": false,
  "has_discussion": true,
  "sections": {
    "lectures": [
      {
        "section_id": "39625",
        "link_code": "A",
        "notes": null,
        "is_cancelled": false,
        "is_full": false,
        "days": ["Mon", "Wed", "Fri"],
        "start_time": "09:00",
        "end_time": "09:50"
      }
    ],
    "labs": [],
    "discussions": [],
    "quizzes": []
  }
}
```

| Field | Used by |
|---|---|
| `units` | unit-overload summary |
| `description` | prereq check (GPA + course-code parsing) |
| `has_d_clearance` | D-clearance check (fallback when the picked sections carry no flag of their own) |
| `has_restrictions` | major-restrictions check |
| `has_lab`, `has_discussion` | lab/discussion pairing check |
| `sections.*[].section_id` | section selection matching |
| `sections.*[].has_d_clearance` | D-clearance check: the picked sections' flags decide, since only some of a course's sections may need it |
| `sections.*[].mode` | lab/discussion pairing check: a combined `Lecture/Lab` or `Lecture/Discussion` section counts as both |
| `sections.*[].link_code` | lab/discussion pairing check (labs, discussions and quizzes; a section with no link code goes with any lecture) |
| `sections.*[].notes` | major-restrictions check |
| `sections.*[].is_cancelled` | excluded from all section-based checks |
| `sections.*[].days`, `start_time`, `end_time` | time-conflict check ("TBA" or malformed values are treated as unresolvable, not a crash) |

### `dept_clearance`

The exact shape of `data/dept_clearance.json` (in this module) — passed in
explicitly rather than read from a hardcoded path. The validator requires
`_schema_version == "1.4"` and raises `ValueError` immediately if it doesn't
match, rather than silently misreading an unfamiliar shape.

## Output schema

```json
{
  "overall_status": "valid | invalid | warning",
  "course_results": [
    {
      "course": "CSCI 104",
      "status": "pass | fail | warning",
      "reasons": ["CSCI 104 is already completed."]
    }
  ],
  "summary": {
    "total_units": 20.0,
    "warnings": ["Planned load is 20.0 units, above the recommended max of 18."]
  }
}
```

Note the two status vocabularies are intentional, not an oversight:
`course_results[].status` uses `pass/fail/warning`, `overall_status` uses
`valid/invalid/warning`. The GUI (`validator_gui_v2.jsx`) already keys off both
exact vocabularies, so unifying them would be a breaking cross-file change —
flagging here instead of changing unilaterally.

## Checks

| Check | Severity | Data source | USC documentation |
|---|---|---|---|
| Already completed | fail, or warning for a repeatable course | `stars_summary.completedCourses` + `course_catalog.description` ("may be repeated", or a Special Topics / Directed Research / Internship / thesis / MUEN ensemble title) | — |
| Already in progress | warning | `stars_summary.inProgressCourses` | — |
| Class standing (400+ level vs. Freshman/Sophomore) | warning | `stars_summary.classLevel` + course number | [USC Registrar glossary](https://esdcomm.usc.edu/arr/glossary/c.html): 300/400-level is "primarily for" juniors/seniors — guidance, not a blanket rule. Actual enforcement is per-course (e.g. CSCI 442/445 require junior standing themselves), which this validator can't see, so this is a `warning` rather than a `fail`. |
| D-clearance | warning (never a hard fail — see below) | selected sections' `has_d_clearance` (else the course's) + `dept_clearance.json` | per-department `source_url` field already inside `dept_clearance.json` |
| Prerequisites | fail / warning | `course_catalog.description`'s prerequisite clause (best-effort "and"/"or" parsing) against `stars_summary`'s completed and in-progress courses | — |
| Not found in catalog | warning | `course_catalog` presence | — |
| Lab/discussion pairing | fail | a lecture picked when the course has lectures; `course_catalog.has_lab` / `has_discussion`; selected sections' `link_code` and `mode` | — |
| Major restrictions | fail / warning ("reserved for X" only ever warns: a program name can't be matched reliably against the report's major) | `course_catalog.has_restrictions` + selected sections' `notes` (best-effort keyword match) | — |
| Time conflict | fail | selected sections' `days` / `start_time` / `end_time` | — |
| Unit overload | warning | sum of `course_catalog.units`, threshold = 18 | ⚠️ no authoritative source linked yet — needs a citation or should be dropped |

D-clearance is always a `warning`, never a `fail`, because `dept_clearance.json`
is keyed by department (not by specific course) and its `clearance_required_for`
text changes every semester — there isn't enough here to be confident a
specific course/section is blocked outright.

## Known limitations

- **Prereq and major-restriction checks are best-effort text parsing**, not a
  structured requirements database. They handle GPA thresholds, plain course
  codes, "reserved for X", "not available for X majors", and "only open to
  undergrad/grad students" patterns. Anything else (e.g. "consent of
  instructor", unit-count-based requirements like "8 units of upper division
  ANTH courses") falls back to an unverified warning rather than a wrong
  pass/fail.
- **Prerequisites are read from the "Prerequisite(s):" clause only**, so a
  "Duplicates credit in", "Corequisite:" or "Recommended preparation:" course
  is never required. "A or B" is met by either and "A and B" / "A, B" needs
  both. A course in progress counts (with a note that it has to be passed).
  It's a warning, not a fail, when the clause offers another route ("or
  equivalent", "or consent of instructor") or mixes "and" with "or"
  ("A or B and C" reads two ways). A number with no department ("Prerequisite:
  101") is an unverified note, since assuming the same department can be wrong.
- **Time conflict** is checked pairwise across each course's *selected*
  sections only — it's a simple `fail` if any of them overlaps any of the
  other course's selected sections, or two of one course's own sections
  overlap (a lecture and a lab at the same hour). An overlap inside a course
  that every choice of its sections shares (AME 441B's only lecture and lab)
  is the department's schedule, so it isn't reported. TBA or malformed section times are
  excluded from the check but surfaced separately as a warning rather than
  silently dropped.
- Course codes are normalized to `"DEPT ###"` (single space) everywhere in
  this module.

## Running tests

```bash
python3 -m pip install -r analytics/requirements-dev.txt  # first time only
python3 -m pytest analytics/test/
```

## Try it against the mock fixtures

```bash
python3 analytics/validate_next_semester.py
```
