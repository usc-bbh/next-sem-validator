// The app's two pages live in the URL hash, so About can be linked to and the
// back button works, without a second HTML page that would drop an uploaded
// report (it's only ever kept in memory).
export const pageFromHash = (hash) => (/^#\/about\/?$/.test(hash) ? "about" : "home");
export const hashForPage = (page) => (page === "about" ? "#/about" : "");
