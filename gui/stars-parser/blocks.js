// Stage 4 — blocks(text) → labelled blocks. See STARS_PARSER_DESIGN.md §6.
//
// Splits the cleaned report on its divider rows (runs of underscores) and
// labels each block from what its heading says, never from where it sits.
// The labels decide where course rows may be read from: only `unitTotal`
// (the master list) and `otherCourses` are authoritative. Every other block
// repeats rows that are already in one of those two.

// A course row: a 5-digit term at the start of the line, then the course.
// The legend's "20263 = FALL SEMESTER 2026" lines also start with a term, so
// they're excluded by the "=".
export const COURSE_ROW = /^ *\d{5} (?!=)\S/;

const DIVIDER = /^_{20,}$/;
const BANNER = /^\*+$/;

// Labels that later stages read, matched against a block's heading: the
// first line that isn't a row of asterisks, joined with the line after it,
// because some headings wrap ("…UNIQUE TO THE APPLIED" / "ANALYTICS MINOR:").
// First match wins.
//
// `courses` says whether the block's course rows are the student's record
// ("record") or a repeat of rows listed elsewhere ("repeat"). Blocks with
// "none" aren't expected to hold course rows at all.
//
// Only blocks that fields.js or checks.js look up by name are here. Every
// other block is labelled by its shape (see structuralLabel), so a major,
// minor or school whose requirements are worded differently needs no entry.
// The table used to list each requirement heading the samples showed, which
// tied parsing to the majors in the sample set: an Environmental Studies
// athlete's NCAA section and an IR major's "ADDITIONAL UNIT REQUIREMENT" both
// failed the parse.
export const LABELS = [
  { label: "header", courses: "none", anchors: [/^PREPARED:/] },
  { label: "graduateData", courses: "none", anchors: [/^GRADUATE PERTINENT DATA SECTION/] },
  { label: "pertinentData", courses: "none", anchors: [/^PERTINENT DATA SECTION/] },
  { label: "unitTotal", courses: "record", anchors: [/MINIMUM OF \d+ UNITS (?:IS )?REQUIRED FOR (?:THE )?DEGREE/] },
  { label: "gpa", courses: "repeat", anchors: [/CUMULATIVE GPA REQUIRED/] },
  { label: "minor", courses: "repeat", anchors: [/^MINOR REQUIREMENTS FOR/] },
  { label: "otherCourses", courses: "record", anchors: [/^OTHER COURSES IN YOUR ACADEMIC ACCOUNT/] },
  { label: "legend", courses: "none", anchors: [/^\*+ +LEGEND +\*+/] },
];

const STATUS = /^(OK|NO|IP)\s+/;

function headingOf(lines) {
  const content = lines.map((line) => line.trim()).filter((t) => t && !BANNER.test(t));
  return content.slice(0, 2).join(" ").replace(STATUS, "");
}

// A sub-requirement line: "  - 2) …", "IP+ 3) …", "+R 8) …", "- OR) …".
const SUB_REQUIREMENT = /^\s*(?:IP)?[+-]R?\s+(?:\d+|OR)\)/;

// Everything that isn't in LABELS. A block that lists courses, carries an
// OK / NO / IP status, or has sub-requirements is a requirement, and its rows
// repeat the record (stage 6 checks that they do). Anything else is a notice:
// a banner, an advisory paragraph, the disclaimer.
function structuralLabel(lines, status) {
  const requirement =
    status !== null ||
    lines.some((line) => COURSE_ROW.test(line) || SUB_REQUIREMENT.test(line) || /^\s*(?:NEEDS|SELECT FROM):/.test(line));
  return requirement ? { label: "requirement", courses: "repeat" } : { label: "notice", courses: "none" };
}

function labelOf(heading, lines, status) {
  for (const entry of LABELS) {
    if (entry.anchors.some((re) => re.test(heading))) return entry;
  }
  return structuralLabel(lines, status);
}

// Returns [{ label, courses, status, heading, lines }], in report order.
// `status` is the block's OK / NO / IP code, or null. Empty blocks (two
// dividers in a row) are dropped.
export function blocks(text) {
  const groups = [];
  let current = [];
  for (const line of text.split("\n")) {
    if (DIVIDER.test(line.trim())) {
      groups.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  groups.push(current);

  return groups
    .filter((lines) => lines.some((line) => line.trim()))
    .map((lines) => {
      const heading = headingOf(lines);
      const first = lines.find((line) => line.trim() && !BANNER.test(line.trim())) ?? "";
      const status = first.trim().match(STATUS)?.[1] ?? null;
      const { label, courses } = labelOf(heading, lines, status);
      return {
        label,
        courses,
        status,
        heading,
        lines,
      };
    });
}
