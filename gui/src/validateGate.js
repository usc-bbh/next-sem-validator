// When Validate can run. The page starts with no report, and there's no
// stand-in record to validate against: Validate stays off until a report is
// read or confirmed, or the student chooses to continue without one
// ("skipped"). Without one, the validator runs only the checks that don't
// need it and says which it skipped.

// The STARS state the page starts in. "none" | "parsing" | "parsed" |
// "review" | "confirmed" | "graduate" | "skipped".
export const INITIAL_STARS = { report: null, source: "none" };

// A report Validate can use: read from the PDF, or saved on the review screen.
export function hasUsableReport(source) {
  return source === "parsed" || source === "confirmed";
}

// The student chose to continue without a report (theirs didn't parse, or
// they don't have it to hand). Courses can be picked and checked, minus the
// report's checks.
// What a check without a report leaves out. The validator's own warning
// (NO_REPORT_WARNING) lists the same ones.
export const SKIPPED_CHECKS = "prerequisites, courses you've already taken, class standing, GPA minimums and major restrictions";

export function withoutReport(source) {
  return source === "skipped";
}

export function canValidate({ source, courseCount, needSections, catalogReady, checkerReady, validating }) {
  return (hasUsableReport(source) || withoutReport(source)) && courseCount > 0 && needSections.length === 0 && catalogReady && checkerReady && !validating;
}

// The line under the Validate button about the report, if it's what's missing.
export function reportHint(source) {
  if (hasUsableReport(source) || withoutReport(source) || source === "parsing") return null;
  return source === "review" ? "Confirm your STARS details to validate." : "Upload your STARS report to validate.";
}
