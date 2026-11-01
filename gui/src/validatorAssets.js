// Files the in-browser checker loads. The sync:validator script copies each
// `from` (relative to gui/) into public/validator/ before dev and build, and
// the app fetches `url`. Neither copy is committed: analytics/ is the source.
export const VALIDATOR_ASSETS = {
  source: { from: "../analytics/validate_next_semester.py", url: "./validator/validate_next_semester.py" },
  // The real D-clearance rules (every department), not a demo subset.
  deptClearance: { from: "../analytics/data/dept_clearance.json", url: "./validator/dept_clearance.json" },
};
