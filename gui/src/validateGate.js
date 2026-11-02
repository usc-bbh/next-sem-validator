// When Validate can run. Every check reads the student's STARS report
// (prerequisites, courses already taken, GPA minimums), so there is no
// stand-in record to validate against: the page starts with no report, and
// Validate stays off until one is read or confirmed.

// The STARS state the page starts in. "none" | "parsing" | "parsed" |
// "review" | "confirmed" | "graduate".
export const INITIAL_STARS = { report: null, source: "none" };

// A report Validate can use: read from the PDF, or saved on the review screen.
export function hasUsableReport(source) {
  return source === "parsed" || source === "confirmed";
}

export function canValidate({ source, courseCount, needSections, catalogReady, checkerReady, validating }) {
  return hasUsableReport(source) && courseCount > 0 && needSections.length === 0 && catalogReady && checkerReady && !validating;
}

// The line under the Validate button about the report, if it's what's missing.
export function reportHint(source) {
  if (hasUsableReport(source) || source === "parsing") return null;
  return source === "review" ? "Confirm your STARS details to validate." : "Upload your STARS report to validate.";
}
