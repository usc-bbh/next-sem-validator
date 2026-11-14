// The app's pages live in the URL hash, so About, Feedback and D-clearance can
// be linked to and the back button works, without a second HTML page that
// would drop an uploaded report (it's only ever kept in memory).
const PAGES = ["about", "feedback", "d-clearance"];

// The D-clearance page can open at one department: #/d-clearance/BUCO.
const DEPT = /^#\/d-clearance\/([A-Za-z-]+)\/?$/;

export const pageFromHash = (hash) =>
  DEPT.test(hash) ? "d-clearance" : PAGES.find((p) => new RegExp(`^#/${p}/?$`).test(hash)) ?? "home";
export const deptFromHash = (hash) => hash.match(DEPT)?.[1].toUpperCase() ?? null;
export const hashForPage = (page, dept = null) =>
  !PAGES.includes(page) ? "" : page === "d-clearance" && dept ? `#/d-clearance/${dept}` : `#/${page}`;
