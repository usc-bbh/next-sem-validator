// How the review screen shows parsed STARS data: term codes as seasons,
// grade codes in words, and courses grouped the way a student reads their
// record (by semester, with transfer credit apart by kind).

const SEASONS = { 1: "Spring", 2: "Summer", 3: "Fall" };

// "20222" → "Summer 2022". USC term codes are the year then 1/2/3 for
// spring/summer/fall. Anything else is shown as printed.
export function termLabel(term) {
  const m = /^((?:19|20)\d\d)([123])$/.exec(term ?? "");
  return m ? `${SEASONS[m[2]]} ${m[1]}` : term || "";
}

// Grades the student can pick, grouped, with what each one means. Codes are
// the parser's, kept exactly as STARS prints them, since passed() and the
// validator read the code.
export const GRADE_GROUPS = [
  { label: "Letter grades", options: ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"].map((g) => [g, g === "F" ? "F (failed)" : g]) },
  {
    label: "Pass / no pass",
    options: [["P", "Pass (P)"], ["NP", "No pass (NP)"], ["CR", "Credit (CR)"], ["NC", "No credit (NC)"]],
  },
  {
    label: "Hidden by redaction",
    options: [["Lp", "Passed, grade hidden"], ["Lf", "Failed, grade hidden"], ["Pp", "Pass, hidden"], ["Pn", "No pass, hidden"]],
  },
  { label: "Transfer", options: [["TR", "Transfer credit"]] },
  {
    label: "Other",
    options: [["W", "Withdrew (W)"], ["IN", "Incomplete (IN)"], ["IX", "Incomplete, lapsed (IX)"], ["MG", "Missing grade (MG)"], ["NS", "No grade submitted (NS)"]],
  },
];

const GRADE_TEXT = new Map(GRADE_GROUPS.flatMap((g) => g.options));

export function gradeLabel(code) {
  return GRADE_TEXT.get(code) ?? code;
}

export function isKnownGrade(code) {
  return GRADE_TEXT.has(code);
}

// Transfer and exam credit, by kind, in the order the boxes appear.
export const TRANSFER_KINDS = [
  { source: "exam", title: "Exam credit (AP, IB)" },
  { source: "transfer", title: "Transfer courses" },
  { source: "transfer_generic", title: "General transfer credit" },
];

// The completed list as boxes: one per USC semester, oldest first, then one
// per kind of transfer credit. Each row keeps its index in the list so edits
// still reach the right row.
export function groupCompleted(rows) {
  const terms = new Map();
  const kinds = new Map(TRANSFER_KINDS.map((k) => [k.source, []]));
  rows.forEach((row, index) => {
    const item = { row, index };
    if (kinds.has(row.source)) kinds.get(row.source).push(item);
    else {
      const key = row.term || "";
      if (!terms.has(key)) terms.set(key, []);
      terms.get(key).push(item);
    }
  });

  const semesters = [...terms.entries()]
    // Rows the student added have no term; they go last.
    .sort(([a], [b]) => (a === "") - (b === "") || a.localeCompare(b))
    .map(([term, items]) => ({ key: `term:${term}`, title: term ? termLabel(term) : "Added by you", items, kind: "term" }));
  const transfer = TRANSFER_KINDS.filter((k) => kinds.get(k.source).length).map((k) => ({
    key: `src:${k.source}`,
    title: k.title,
    items: kinds.get(k.source),
    kind: "transfer",
  }));
  return [...semesters, ...transfer];
}

export function sumUnits(rows) {
  return rows.reduce((total, row) => total + (Number(row.units) || 0), 0);
}

// The list's totals beside the report's own. USC caps applied transfer
// credit, so transfer counts at the report's TRNSFR WORK figure rather than
// the sum of transfer rows (which is often larger).
export function unitTotals(report) {
  const counts = (row) => row.passed !== false;
  const usc = sumUnits(report.completedCourses.filter((r) => counts(r) && !TRANSFER_KINDS.some((k) => k.source === r.source)));
  const transfer = report.units?.transferTotal ?? 0;
  return {
    usc,
    transfer,
    completed: usc + transfer,
    earned: report.units?.earned ?? null,
    inProgress: sumUnits(report.inProgressCourses),
    reportInProgress: report.units?.inProgress ?? null,
  };
}
