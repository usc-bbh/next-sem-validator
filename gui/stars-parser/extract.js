// Stage 1 — extract(pdf) → pages of fragments. See STARS_PARSER_DESIGN.md §4.
//
// The only stage that touches pdf.js, and the library is passed in rather
// than imported. The browser hands over pdfjs-dist's browser build
// (pdfSource.js), and scripts/extract-fixture.mjs hands over the legacy
// Node build, so this one function serves both.

// Returns one array per page. Each fragment is
//   { str, x, y, width, height }
// where x is the left edge and y the baseline, both in PDF points (y grows
// upwards). Empty fragments, which pdf.js emits to mark line ends, are dropped.
export async function extractPages(pdfjsLib, data) {
  const task = pdfjsLib.getDocument({ data, verbosity: 0 });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      pages.push(
        items
          .filter((item) => typeof item.str === "string" && item.str !== "")
          .map((item) => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
          }))
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
