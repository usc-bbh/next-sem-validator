# STARS parser — plan of attack

_Tanzil Hussain, with Claude support. October 2026._

**Owner: Tanzil Hussain**, for both the parser and the validator, as of October 2026. This replaces the ownership split proposed in `docs/parser-brief.md` §1. Owning both ends means changes to the output format between them can be made in one PR.

This is the plan for rebuilding the STARS parser in `gui/stars-parser/`. It replaces the build guidance in `docs/parser-brief.md` (in bbh-course-reg-project) wherever the two disagree. The brief's approach is mostly right. But testing it against 11 real redacted reports turned up several places where the report doesn't behave the way the brief, or `docs/reference/01-reading-a-stars-report.md`, describes. Each section below says what we'll do and why, and cites the report that forced the decision.

The brief's own rule still holds: **if a real report contradicts this plan, the report wins.**

---

## 1. Summary

- **Pipeline:** six stages. Each is a pure function, and plain text passes between the first two and the rest. Only stage 1 touches the PDF or the browser.
- **Rebuilding lines:** group text fragments into lines by baseline with a **2pt tolerance**, not an exact match. Then rebuild each line as **fixed-width columns** from the x positions.
  - The current code drops every grade on redacted reports.
  - The report body is a fixed-width printout, so columns are the reliable way to read it.
- **Reading course rows:** slice each row by column, not with a free-form regex. Columns survive glued flags (`>IPCommunication`), suffixes with spaces in them (`L G`), and padded codes (`IR  101`).
- **Transfer credit:** classify by what the row actually is: USC course, exam credit (AP/IB), another school's own code, or generic `TR-` credit. The `TR` grade alone doesn't tell you which. Equivalences come from the `RE - SUB … FOR …` notes.
- **Self-check:** units earned = completed USC rows + the `TRNSFR WORK` total. This held exactly on all 11 samples. The brief's check (transfer rows add up to `TRNSFR WORK`) fails on most of them, because exam credit is capped.
- **Fixtures:** 11 redacted undergrad samples become shared `fixtures/stars/<name>.txt` + `.json` pairs. The JSON is checked by hand against the PDF, not generated and then trusted.
- **Build order:** milestones in section 10. Each one is shippable on its own. The app gets the new parser at milestone 3.

---

## 2. Why a new plan

### What the brief gets right, and we keep

- One supported input: the single-column print-to-PDF from `experience.usc.edu`. No OCR, no two-column layout.
- JavaScript, client-side, with PDF→text kept separate from text→data so parsing is testable from a terminal against `.txt` files.
- Anchor on content, never on line numbers. Split on divider rows. Label chunks by what they contain. Treat a missing section as normal.
- `major` comes from the header `PROGRAM:` line. The double-degree sample proves it: its current-post row lists `242 BA IR` first, but `PROGRAM: 1915` is the AI-for-Business report.
- Build the course list from the master list plus "other courses", removing duplicates by (term, code). `CSCI114` appears in both on `aibiz_sr_minor`.
- `RG` / `>IP` means in progress, including future-term registrations.
- Fail loudly instead of returning a plausible-looking subset.

### What real reports contradict

| Claim | Where it's made | What the 11 samples show |
|---|---|---|
| Grouping fragments on the exact baseline rebuilds lines correctly | brief §5, `lineRebuilder.js` | Redacted grade tokens sit **0.16pt below** their row. Exact grouping puts every grade on a line of its own (24–58 orphaned per report). See §4. |
| Fragments on a line should be joined with `""` | `lineRebuilder.js` | Once grades rejoin their rows, `""` glues them to the title: `4.0 LpStatistics…`. See §4. |
| A transfer mapped to a USC course appears under that USC code with `TR` | brief §7, doc 01 | Not seen in any sample. Transfers keep their source codes (`AP66:COMP`, `CMPR120`, `ANTH101`, `PHYS250A`, `ENGLISH`, `HIS/AMERIC`) or appear as `TR-*`. Equivalence shows up only as a note in a requirement block: `NOTE: RE - SUB CMPR120 FOR CSCI113`. |
| A transfer appears in a requirement block **or** "other courses", never both | brief §7 | The Dornsife 104-unit block (`amcm_jr`, `psyc_so_thematic`) and the elective summary after the legend repeat AP rows that are also under "other courses". |
| Collected transfer units should add up to `TRNSFR WORK` | brief §7, §10 | They don't. `csci_sr_renaissance` lists 12 AP exams (48u) against `TRNSFR WORK 32.0`, and `buad_jr_ib` lists 40u against 32. No sample's total exceeds 32: exam credit looks capped `[inferred]`. |
| NCAA is the only non-degree section that repeats course rows | brief §8–9, doc 01 | The `INTERNAL USE ONLY` and `FA INTERNAL AUDITING` blocks after the legend, the Renaissance honors GPA block, and the Dornsife 104-unit block all repeat course rows. |
| "64 and RESIDEN" identifies the residence block | brief §8 | One wording is `A MINIMUM OF 64 UNDERGRADUATE UNITS MUST COMPLETED AT USC`, with no "RESIDEN" in it. |
| 128 units | doc 01/02 | Environmental Engineering: `MINIMUM OF 130 UNITS REQUIRED FOR THE DEGREE`. |
| Course row grammar `TERM COURSE [suffixes] UNITS GRADE [>flags] TITLE`, e.g. `>IP Sustainability` | doc 01 | The flag is glued to the title (`>IPCommunication`, `>FFApplied`). The suffix column can contain spaces (`L G`) or combine codes (`LXG`, `XGW`, `GP`). Codes are padded (`IR  101`, `EE  109`). |
| Grade vocabulary is the legend's | doc 01 | `CR` and `W` also appear (`ene_fr_withdrawals` has `0.0 W`). On redacted samples every letter grade is a token: `Lp`, `Lf`, `Pp`, `Pn`. |
| Status codes are `OK`/`NO`/`IP` and `+`/`-` | doc 01 | Also `IP+`, `IP-`, `+R`, sub-requirements with no marker, and `- OR)` alternatives. |
| Count labels are UNITS / SUB-GROUPS / COURSES / GPA | doc 01 | Also `SET` and `HOUR`. |
| Every page has a header with a timestamp and the URL | doc 01 | Three samples have none. Date formats vary: `7/2/26, 7:26 PM` vs `28/09/2026, 18:42`. |
| ~350+ non-empty lines | brief §5 | 280–405 across the samples. First-semester reports run under 300. |

We'll file the doc corrections upstream separately (section 12). This plan just builds on what the reports show.

### Related work

- **bbh PR #4** (`tanzil/stars-parser-scope-and-chunking`, open, last updated 8 Sept) already has a chunker (`chunker.js` plus tests), the scope narrowing, and the brief's three-value transfer `source`. It targets bbh's `stars-parser/`, which is being removed. Port the chunker into M0/M2 here, switch the `source` field to the revised taxonomy in section 7, then close PR #4.
- **Constellation** (`bbh-course-reg-project/constellation/`, nlj19366) is a separate STARS report viewer with its own parser. It is **not** this parser and doesn't share code with it. Its `pdftext.js` also groups lines with a tolerance (`max(2, 0.4 × height)`), which is independent confirmation of the stage 2 fix.

---

## 3. Scope

**In scope:** undergraduate STARS reports, single-column, printed to PDF from `experience.usc.edu`, with a text layer. Both redacted and real uploads.

**Out of scope, and we delete the code rather than maintain it:**

- `ocrExtract.js` and the `tesseract.js` dependency.
- The ten OCR fixtures in `test/fixtures/` (output from scanned two-column reports).
- `test/parser.test.js`, which re-implements the parser inside the test file and so tests a copy.

**Detected and refused, with a clear message:** graduate reports (`Master of Science`, `GRADUATE PERTINENT DATA SECTION`; the `grad_apsy` sample). Their layout and requirement types are different, and the validator is undergrad-only.

---

## 4. Stages 1–2: from PDF to fixed-width text

This is where the current parser fails before any parsing logic runs. Every fix here was measured on the 12 sample PDFs, using the pdfjs build already in `gui/node_modules`.

### Stage 1 — `extract(pdf) → pages of fragments`

`page.getTextContent()` for each page. We keep `str`, `transform[4]` (x), `transform[5]` (baseline y), `width` and `height`. This is the only stage that imports pdfjs. For Node (fixture generation), use `pdfjs-dist/legacy/build/pdf.mjs`.

### Stage 2 — `layout(fragments) → text`

**Group by baseline with a 2pt tolerance.** Rows are 9pt apart, and the redaction tokens sit 0.16pt off their row, so 2pt has wide margins on both sides.

| | exact grouping | 2pt tolerance |
|---|---|---|
| grade tokens orphaned on their own line | 24–58 per redacted report | 0 on all 12 |
| lines holding two course rows (bad merges) | 0 | 0 |

**Rebuild each line as fixed-width columns, not by joining strings.** The body is a fixed-width printout. Each PDF has a single dominant character width (3.61pt on US-locale prints, 3.30pt on the European-locale one). The left margin varies (term column at x=144.5 on one, 136.2 on another). So, for each document:

1. Take the most common `width / str.length` across body fragments as the character width `cw`.
2. Take the left margin `x0` as the minimum x of fragments that match `^\d{5}$` at the start of a line. Fall back to the minimum x of body fragments.
3. Place each fragment at column `round((x − x0) / cw)`, padding with spaces.

The result is a monospaced line where every field of a course row lands in a fixed column, no matter how the PDF split the fragments. This one choice handles glued flags, spaced suffixes, padded codes and redaction tokens. Joining with `""` or `" "` can't handle all of those at once.

**Sanity gates, run on every extraction (also in tests):** zero orphaned grade-token lines, zero lines containing two term codes, and line count well above page count.

Stage 2's output is exactly what gets committed as `fixtures/stars/<name>.txt`. Everything after it runs on plain text.

---

## 5. Stage 3 — clean

1. Drop everything before the first `PREPARED:` line. That's the print preamble with the name and ID.
2. Drop page furniture:
   - The header: a date in either `M/D/YY, h:mm AM` or `DD/MM/YYYY, HH:mm` form, followed by `USC STARS Report`.
   - The footer: a run of redaction `x`s or a URL, then `n/N`.
   - Treat their absence as normal; three samples have none.
3. Drop the web-page boilerplate at the end (`Need help?`, `Technical Issues:`, privacy links).
4. Leave everything else alone. Redacted values (`X.XXX`) stay as printed so later stages can recognise them.

---

## 6. Stage 4 — split into labelled blocks

Split on runs of underscores (divider rows). Asterisk runs frame banners. Then label each block from a **table of anchors**, matching the first line with regexes. The table is data, not code scattered through the parser, so a new variant is a one-line change with a test.

| Label | Anchors (any of) | Course rows inside? |
|---|---|---|
| `header` | `PREPARED:` … `PERTINENT DATA SECTION` | no |
| `currentPost` | `CURRENT POST:` | no |
| `unitTotal` (the master list) | `MINIMUM OF \d+ UNITS (IS )?REQUIRED` | **yes, authoritative** |
| `residence` | `64-UNIT RESIDENCY`, `64 UNDERGRADUATE UNITS MUST` | no |
| `upperDivision` | `32-UNIT UPPER DIVISION`, `32 UPPER DIVISION UNITS` | no |
| `gpa*` | `CUMULATIVE GPA REQUIRED` | repeats |
| `deptLimit` | `LIMIT OF 40 UPPER DIVISION UNITS` | repeats |
| `dornsife104` | `104 UNITS APPLICABLE` | repeats, including transfers |
| `writing`, `foreignLanguage`, `ge*`, `thematicOption`, `math`, `econ`, `accounting` | their headings | repeats |
| `major*` | `MAJOR REQUIREMENTS`, `REQUIRED UPPER DIVISION BUSINESS`, `PRE-MAJOR`, `COMPUTATIONAL AREA`, … | repeats |
| `minor*` | `MINOR REQUIREMENTS`, `UNIQUE TO THE .* MINOR` | repeats |
| `unitCaps` | `PHYSICAL EDUCATION ACTIVITY` | repeats |
| `currentRegistration` | `CURRENT REGISTRATION` | repeats |
| `otherCourses` | `OTHER COURSES IN YOUR ACADEMIC ACCOUNT` | **yes, authoritative** |
| `legend` | `\*\*\*\* LEGEND` | no |
| `renaissance` | `RENAISSANCE HONORS` | repeats |
| `internalAudit` | `INTERNAL USE ONLY`, `FA INTERNAL AUDITING` | repeats |
| `ncaa` | `NCAA` | repeats |
| `disclaimer` | `Degree Progress Advisement report has been prepared` | no |

Rules:

- **Course rows are harvested only from `unitTotal` and `otherCourses`.** There's one exception, transfer rows (section 7). Every other block repeats rows.
- **Unrecognised blocks are kept, labelled `unknown`, and reported in a `warnings` list.** They aren't errors: reports vary by school and program, and we've seen 11. But if a block labelled `unknown` contains course rows, the parse fails. That's exactly the "right pattern, wrong part of the document" bug the brief warned about.
- **Missing sections are normal.** No minor, no NCAA, no time-to-degree banner (missing on all three first-semester samples), no diploma block. The only required landmarks are `header`, `currentPost`, `unitTotal` and `legend`.

---

## 7. Stage 5 — fields and the course list

### Course rows, sliced by column

Within the `unitTotal` and `otherCourses` blocks, a course row is a line whose first field is a 5-digit term. Fields are cut at fixed column offsets, calibrated once from the samples and asserted in tests:

| Field | Example | Notes |
|---|---|---|
| term | `20243` | Kept raw. `99993` marks the `TRNSFR WORK` summary line: read it as `transferTotal`, never as a course. |
| code | `BUAD312`, `IR  101`, `AP34:COMP`, `TR-COMP-2`, `HIS/AMERIC`, `DIPLOMA+2` | Taken as the whole field, so any code shape passes through. |
| suffixes | `G`, `L`, `X`, `L G`, `LXG`, `XGW`, `GP` | Split into a set of letters. Spaces are padding. |
| units | `4.0`, `0.0` | Number. |
| grade | `A-`, `CR`, `TR`, `RG`, `W`, `Lp`, `Lf`, `Pp`, `Pn` | Kept exactly as printed. |
| flags | `>IP`, `>FF`, `>D`, `>Z`, `>EX`, `>OS`, `>P`, `>R` | Fixed 3-character slot directly before the title, so `>IPCommunication` splits cleanly. |
| title | truncated | Display only. Never matched on. |

**What the redaction tokens mean** (from `STARSRedacter/redact_stars.py`): the first letter is the grading basis (`L` letter grade, `P` pass/no-pass) and the second is the outcome (`p` passed, `f`/`n` not passed). The parser keeps the token as the grade and also sets `redacted: true` on the parse. The fail rule then works on redacted samples: `Lf` and `Pn` count as not passed. The C-or-below caution rule can't run on them, and that's expected.

**Status:**

- In progress: `RG` or `>IP`.
- Completed: everything else, including `W`, `>D`, `>FF` and `>Z` rows. They're on the record, but their earned units are whatever's printed (these print `0.0`) and they don't count as passed.
- Passed follows the stopgap rule in doc 02 §7, extended to the redaction tokens.

**Code normalisation:** emit `code` as `DEPT NNN[L]` when the raw code has that shape (`BUAD312` → `BUAD 312`, `IR  101` → `IR 101`), matching the validator fixture and `_normalize_code`. Always keep `rawCode`. Any other shape (`AP34:COMP`, `TR-…`) is passed through unchanged, never reshaped.

### Transfer credit — revised model

The `source` field is decided by **what the row is**, not just by its `TR` grade:

| `source` | How it's detected | Example | Satisfies USC prerequisites? |
|---|---|---|---|
| `usc` | grade isn't `TR` | `20251 CSCI103` | yes |
| `exam` | `TR` + code matches `^AP\d+:` or an IB label (`IBTEST:` in the title, `DIPLOMA+`) | `AP66:COMP`, `ENGLISH … IBTEST: ENGLISH` | only through an equivalence (below) |
| `transfer` | `TR` + a course-code shape that isn't `TR-` | `CMPR120`, `ANTH101`, `PHYS250A` | only through an equivalence |
| `transfer_generic` | `TR` + `TR-` prefix | `TR-COMP-2`, `TR-WMNSTUD` | never |

Why this differs from the brief's three values:

- In these samples the `TR` grade never marks a row that already carries a USC code.
- `CMPR120` and `ANTH101` look exactly like USC codes, but they're the other institution's codes. Tagging them as USC-equivalent is the false-match risk the brief warns about.

**Equivalences.** Parse `NOTE: RE - SUB <from> FOR <to>` lines anywhere in the report into `equivalents: [{ from, to }]`. Example from `aibiz_jr_doubledegree`: CMPR120 → CSCI113, CMPR131 → CSCI114. Also parse `CW - COURSE WAIVED <code>` into `waivedCourses` (`DSCI281`, `TAC 115`). Both affect prerequisites, so both are worth having.

**Where transfer rows are collected.** From `otherCourses`, **and** from requirement blocks, because a transfer applied to a requirement is listed only there (`AP31:COMP` in the CS core, `CMPR120` in AI-for-Business). Harvest only rows whose grade is `TR`, and remove duplicates by (term, code), since an AP row can sit in several blocks (`AP68` is under both GE-F and Math). Non-transfer rows inside requirement blocks are still never harvested.

### Header fields

`prepared`, `programCode` and `catalogYear` come from the header. `degree` and `major` come from the title lines under `STARS - DEGREE PROGRESS REPORT` (for example `BACHELOR OF SCIENCE` / `ARTIFICIAL INTELLIGENCE FOR BUSINESS`). The rest:

- `classLevel` and the entry term.
- `expectedGraduation`, when present.
- Every `CURRENT POST` row, kept as a list; the double-degree sample has two.
- `minors[]` with each minor's own catalog year (`MINOR CATALOG YEAR IS PROCESSED AS 20243`).
- `unitsRequired` from the unit block (128 or 130).
- `gpa`: a number, or `null` when printed as `X.XXX` or `NEEDS: GPA`.

### Requirement blocks (milestone 5, for the degree planner)

Each labelled requirement block becomes:

- `{ label, status: OK|NO|IP, tallies, subgroups[] }`
- each subgroup is `{ number, status: + | - | IP+ | IP- | +R | none, needs, selectFrom, notes, courses }`

Numbering can skip (`1)` → `3)`) and include `OR)`. This isn't needed by the validator, so it comes last, but stage 4 already lays the groundwork.

---

## 8. Output contract

We keep the five fields the validator reads (`major`, `classLevel`, `gpa`, `completedCourses`, `inProgressCourses`) and add to them. The validator reads only `.code` and `.grade` per course, so the additions don't break it.

```jsonc
{
  "meta": { "prepared": "07/01/26", "programCode": "1915", "catalogYear": "20243",
            "redacted": true, "warnings": [] },
  "degree": "BS", "major": "Artificial Intelligence for Business",
  "classLevel": "Senior", "gpa": null,
  "posts": [{ "program": "1915", "degree": "BS", "major": "BUAI", "school": "BUAD", "term": "20243" }],
  "minors": [{ "name": "Applied Analytics", "catalogYear": "20243" }],
  "units": { "required": 128, "earned": 96, "inProgress": 24, "transferTotal": 28 },
  "completedCourses": [
    { "term": "20243", "code": "BUAD 312", "rawCode": "BUAD312", "units": 4.0, "grade": "Lp",
      "suffixes": ["G"], "flags": [], "source": "usc", "passed": true }
  ],
  "inProgressCourses": [ /* same shape, grade "RG" */ ],
  "equivalents": [], "waivedCourses": ["DSCI281"],
  "requirements": [ /* milestone 5 */ ]
}
```

---

## 9. Stage 6 — check, and fail loudly

Throw a `StarsParseError` naming the failed check. Never return a partial object. Checks:

1. **Landmarks present:** `header`, `currentPost`, `unitTotal`, `legend`.
2. **Every master-list row parsed:** the number of term-led lines in `unitTotal` equals the rows produced from it.
3. **Units earned reconcile:** the sum of printed units on completed USC rows from the master list, plus `TRNSFR WORK`, equals `EARNED`. Checked by hand on all 11 samples, with no exceptions.
4. **Units in progress reconcile:** the sum of in-progress row units equals `IN-PROCESS`. Checked on `aibiz_sr_minor` (24), `aibiz_sr_forgiveness` (18), `aibiz_jr_doubledegree` (31), `ene_fr_withdrawals` (16) and `psyc_so_thematic` (18).
5. **Class level matches units earned** (under 32 Freshman, 32–63.9 Sophomore, 64–95.9 Junior, 96+ Senior). Held on all 11.
6. **No unlabelled block contains course rows** (section 6).

If check 3 fails on a real upload, the UI says the report couldn't be read reliably and offers manual entry. It does not show a course list that's probably wrong.

---

## 10. Build order

Each milestone ends with green tests and is small enough to review in one sitting.

| # | Milestone | Done when |
|---|---|---|
| M0 | **Clear the ground.** Delete OCR, the old fixtures and the self-copying test. Fix the README (source is `experience.usc.edu`, not `my.usc.edu`). | `node --test` runs and imports only real modules. |
| M1 | **Stages 1–2 + fixture extraction script** (`scripts/extract-fixture.mjs`, Node, legacy pdfjs). Commit 11 `.txt` fixtures. | The section 4 sanity gates pass on all 11. Unit tests on synthetic fragments cover tolerance, columns and two different character widths. |
| M2 | **Stages 3–4.** Cleaning and the block label table. | Every block in every fixture is labelled or listed in `warnings`. A test shows the label table for each fixture. |
| M3 | **Course list, transfers, checks 1–6.** Hand-checked `.json` for the validator's fields. **Switch the app to the new parser here.** | Units reconcile on all 11. The validator test suite loads the shared `.json` files. |
| M4 | **Full header and output contract.** GPA as nullable, `equivalents`, `waivedCourses`, graduate-report refusal. | Golden tests for the full `.json`. The validator handles `gpa: null`. |
| M5 | **Structured requirement blocks** for the degree planner. | Requirement blocks parsed for all 11 and agreed with Natalie and Francis on shape. |

### Fixtures

| Name | Source PDF | Why it's in the set |
|---|---|---|
| `aibiz_sr_minor` | `72FB0DD8…` | Minor; `>D` row; course in both master list and other courses |
| `aibiz_sr_forgiveness` | `3A991FE9…` | `>FF` with `Lf`; course waivers; excess free elective; PHED cap; no browser header |
| `aibiz_jr_doubledegree` | `3FD926F8…` | Two current posts; Thematic Option; community-college transfers; `TR-*`; `RE` substitutions |
| `aibiz_so` | `7F67581D…` | First semester; practicum; no time-to-degree banner |
| `csci_sr_renaissance` | `0EC7050D…` | Viterbi; Renaissance block; music minor; `Pp`; diploma block; no browser header |
| `buad_jr_ib` | `2F6DE44F…` | Marshall; IB credit; English minor; no browser header |
| `buad_fr` | `B46D7E78…` | Freshman; summer pre-college course |
| `amcm_jr` | `41168476…` | Dornsife 104-unit block (repeats rows); foreign language |
| `cpns_so` | `BCFFBA34…` | Dornsife; foreign language met by AP credit |
| `psyc_so_thematic` | `7F0714F4…` | Thematic Option; language waiver |
| `ene_fr_withdrawals` | `3D04E54E…` | 130 units; `W` grades; European date format; 3.30pt characters |
| `grad_apsy` | `45E77EB0…` | **Refusal test only.** No `.json`. |

Before committing any fixture, check that the preamble and diploma lines contain only redaction `x`s (doc 01, "Where the personal information sits").

**Still missing from the set:** an athlete (NCAA section), a study-abroad student, an unredacted report (real letter grades, real GPA), and a transfer that came in under a real USC code, if that happens at all. Ask for these through the collection tool. The NCAA skip ships untested until we have one.

---

## 11. Open questions

- **Before M0: finish moving the parser into this repo.**
  1. ~~Merge `parser-from-bbh` here.~~ Done in #3 (7 Oct): the `gui/bbh` submodule is gone and the app imports `gui/stars-parser/`.
  2. Merge `fd17f90` (bbh's `stars-parser/` removal) into bbh through a new PR. It already updates bbh's README, CONTRIBUTING and degree-planner references. Constellation's README still says RegCheck pins `stars-parser/` through a submodule, so let nlj19366 know.
- **Validator side, decide before M4:** how should the validator treat `gpa: null` on redacted reports? Skip GPA-threshold prerequisite checks and warn, or fail? And should the prerequisite check count only `source: "usc"` courses plus `equivalents`, so `ANTH101` from a community college can't match a USC `ANTH 101`? Recommendation: yes, to both the skip-with-warning and the stricter matching.
- **Unredacted grades:** do real letter grades sit exactly on the row baseline? We can't tell from redacted samples. The 2pt tolerance handles either case, but the first unredacted report should confirm it.
- **The 32-unit exam-credit cap** `[inferred]`: no sample's `TRNSFR WORK` exceeds 32 while the AP rows listed do. Confirm with advising before the degree planner relies on it.
- **Character-width inference** assumes one dominant fixed-width font per document. True on all 12 samples. Check 2 in section 9 catches a report where it isn't.

---

## 12. Corrections to send upstream

These belong in bbh-course-reg-project as an issue against `docs/reference/01-reading-a-stars-report.md` and `docs/parser-brief.md`, following that README's "the report wins" rule:

- Course-row layout: glued flags, suffixes with spaces, padded codes, and `CR`/`W` grades.
- Redaction tokens `Lp`/`Lf`/`Pp`/`Pn` and `X.XXX`.
- Status codes `IP+`/`IP-`/`+R`/`OR)` and count labels `SET`/`HOUR`.
- The post-legend internal audit blocks, the Renaissance block and the Dornsife block all repeat course rows.
- How transfers actually appear (source codes plus `RE` notes), and that they can appear in both places.
- The `TRNSFR WORK` cap, and the units-earned check that does hold (USC rows + `TRNSFR WORK`).
- The residence and unit-total wording variants (130 units).
- Missing browser headers and both date formats.
- `AVE` appears on graduate reports from the same export, not only on legacy registrar reports.
