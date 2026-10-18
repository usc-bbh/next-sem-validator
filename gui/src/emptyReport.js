// The review screen's starting point when a parse fails: the parser's output
// shape (STARS_PARSER_DESIGN.md §8) with nothing filled in. The student fills
// in what the validator needs.
export const EMPTY_REPORT = {
  meta: { prepared: null, programCode: null, catalogYear: null, redacted: false, warnings: [] },
  degree: null,
  major: "",
  classLevel: null,
  entryTerm: null,
  expectedGraduation: null,
  gpa: null,
  posts: [],
  minors: [],
  units: { required: null, earned: null, inProgress: null, transferTotal: 0 },
  completedCourses: [],
  inProgressCourses: [],
  equivalents: [],
  waivedCourses: [],
};
