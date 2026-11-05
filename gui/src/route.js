// The app's pages live in the URL hash, so About and Feedback can be linked to
// and the back button works, without a second HTML page that would drop an
// uploaded report (it's only ever kept in memory).
const PAGES = ["about", "feedback"];
export const pageFromHash = (hash) => PAGES.find((p) => new RegExp(`^#/${p}/?$`).test(hash)) ?? "home";
export const hashForPage = (page) => (PAGES.includes(page) ? `#/${page}` : "");
