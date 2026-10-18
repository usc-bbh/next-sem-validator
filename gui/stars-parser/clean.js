// Stage 3 — clean(text) → text. See STARS_PARSER_DESIGN.md §5.
//
// Removes what the browser and the STARS web page add around the report, so
// that stage 4 sees only the report's own lines, with no page breaks in the
// middle of a block. Everything else is left exactly as printed, including
// redacted values (X.XXX), which later stages need to recognise.

// The browser's print header, in either locale's date format:
//   7/2/26, 7:26 PM          USC STARS Report
//   28/09/2026, 18:42        USC STARS Report
const PAGE_HEADER = /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}(?: [AP]M)? +USC STARS Report$/;

// The browser's print footer: the page URL, or STARSRedacter's Xs over it,
// then the page number.
const PAGE_FOOTER = /^(?:X+|https?:\/\/\S+) +\d+\/\d+$/;

// The STARS web page's own footer, printed after the report ends.
const WEB_BOILERPLATE = [/^Need help\?$/, /^Technical Issues:/, /^Privacy Notice \|/];

const END_OF_ANALYSIS = /^\*+ END OF ANALYSIS \*+$/;

export function clean(text) {
  const lines = text.split("\n");

  // 1. Everything before the first PREPARED: line is the print preamble,
  //    which holds the student's name and ID and nothing the parser needs.
  const start = lines.findIndex((line) => line.startsWith("PREPARED:"));
  if (start === -1) return "";

  const out = [];
  for (const line of lines.slice(start)) {
    const t = line.trim();
    // 2. Page furniture. Three samples have none, which is fine.
    if (PAGE_HEADER.test(t) || PAGE_FOOTER.test(t)) continue;
    // 3. The web page's footer.
    if (WEB_BOILERPLATE.some((re) => re.test(t))) continue;
    out.push(line);
    if (END_OF_ANALYSIS.test(t)) break;
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out.join("\n") + "\n";
}
