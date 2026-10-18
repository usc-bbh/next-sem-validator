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

// Each block's label, matched against its heading: the first line that isn't
// a row of asterisks, joined with the line after it, because some headings
// wrap ("…UNIQUE TO THE APPLIED" / "ANALYTICS MINOR:"). First match wins, so
// the more specific anchors come first.
//
// `courses` says whether the block's course rows are the student's record
// ("record") or a repeat of rows listed elsewhere ("repeat"). Blocks with
// "none" aren't expected to hold course rows at all.
//
// A new variant is a one-line change here, plus a fixture that shows it.
export const LABELS = [
  { label: "header", courses: "none", anchors: [/^PREPARED:/] },
  { label: "graduateData", courses: "none", anchors: [/^GRADUATE PERTINENT DATA SECTION/] },
  { label: "pertinentData", courses: "none", anchors: [/^PERTINENT DATA SECTION/] },
  { label: "summary", courses: "none", anchors: [/^AT LEAST ONE REQUIREMENT HAS NOT BEEN SATISFIED/, /^ALL REQUIREMENTS (?:HAVE BEEN|ARE) /] },
  {
    label: "notice",
    courses: "none",
    anchors: [
      /^NOTE: The Legend to STARS/,
      /YOU ARE IDENTIFIED AS A RENAISSANCE SCHOLAR/,
      /Advisory information related to your Program of Study/,
      /TIME TO DEGREE COMPLETION STATUS/,
      /^YOUR PROGRAM REQUIRES A PRACTICUM/,
      /^INTERNATIONAL STUDENTS WORKING TOWARD/,
      /^PLEASE NOTE THE FOLLOWING GENERAL EDUCATION LIMITATIONS/,
    ],
  },
  { label: "unitTotal", courses: "record", anchors: [/MINIMUM OF \d+ UNITS (?:IS )?REQUIRED FOR (?:THE )?DEGREE/] },
  { label: "residence", courses: "none", anchors: [/64-UNIT RESIDENCY/, /64 UNDERGRADUATE UNITS MUST/] },
  { label: "upperDivision", courses: "none", anchors: [/32-UNIT UPPER DIVISION/, /32 UPPER DIVISION UNITS/] },
  { label: "dornsife104", courses: "repeat", anchors: [/104 UNITS APPLICABLE/] },
  { label: "renaissance", courses: "repeat", anchors: [/RENAISSANCE HONORS/] },
  { label: "gpa", courses: "repeat", anchors: [/CUMULATIVE GPA REQUIRED/] },
  { label: "deptLimit", courses: "repeat", anchors: [/LIMIT OF 40 UPPER DIVISION UNITS/] },
  { label: "unitCaps", courses: "repeat", anchors: [/PHYSICAL EDUCATION ACTIVITY/] },
  { label: "writing", courses: "repeat", anchors: [/COMPOSITION\/WRITING REQUIREMENT/] },
  { label: "foreignLanguage", courses: "repeat", anchors: [/FOREIGN LANGUAGE REQUIREMENT/] },
  { label: "geCore", courses: "repeat", anchors: [/GENERAL EDUCATION CORE LITERACIES/] },
  { label: "geGlobal", courses: "repeat", anchors: [/GENERAL EDUCATION GLOBAL PERSPECTIVES/] },
  { label: "thematicOption", courses: "repeat", anchors: [/THEMATIC OPTION REQUIREMENTS/] },
  { label: "minorUnique", courses: "repeat", anchors: [/MUST BE UNIQUE TO THE .*MINOR/] },
  { label: "minor", courses: "repeat", anchors: [/MINOR REQUIREMENTS FOR/] },
  {
    label: "major",
    courses: "repeat",
    anchors: [
      /MAJOR REQUIREMENTS/,
      /PRE-MAJOR/,
      /REQUIRED UPPER DIVISION BUSINESS/,
      /UPPER DIVISION REQUIREMENTS FOR/,
      /DEPARTMENT MAJOR UPPER DIVISION/,
      /COMPUTATIONAL AREA/,
      /QUANTITATIVE ELECTIVE/,
    ],
  },
  { label: "math", courses: "repeat", anchors: [/MATH REQUIREMENT/] },
  { label: "econ", courses: "repeat", anchors: [/ECONOMICS REQUIREMENT/] },
  { label: "accounting", courses: "repeat", anchors: [/ACCOUNTING REQUIREMENT/] },
  { label: "currentRegistration", courses: "repeat", anchors: [/^CURRENT REGISTRATION:/] },
  { label: "otherCourses", courses: "record", anchors: [/^OTHER COURSES IN YOUR ACADEMIC ACCOUNT/] },
  { label: "legend", courses: "none", anchors: [/^\*+ +LEGEND +\*+/] },
  { label: "internalAudit", courses: "repeat", anchors: [/INTERNAL USE ONLY/, /FA INTERNAL AUDITING/, /^SACN:/] },
  { label: "ncaa", courses: "repeat", anchors: [/\bNCAA\b/] },
  { label: "disclaimer", courses: "none", anchors: [/Degree Progress Advisement report has been prepared/] },
  { label: "end", courses: "none", anchors: [/END OF ANALYSIS/] },
];

const STATUS = /^(OK|NO|IP)\s+/;

function headingOf(lines) {
  const content = lines.map((line) => line.trim()).filter((t) => t && !BANNER.test(t));
  return content.slice(0, 2).join(" ").replace(STATUS, "");
}

function labelOf(heading) {
  for (const entry of LABELS) {
    if (entry.anchors.some((re) => re.test(heading))) return entry;
  }
  return { label: "unknown", courses: "none" };
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
      const { label, courses } = labelOf(heading);
      return {
        label,
        courses,
        status: first.trim().match(STATUS)?.[1] ?? null,
        heading,
        lines,
      };
    });
}
