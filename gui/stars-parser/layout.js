// Stage 2 — layout(pages) → text. See STARS_PARSER_DESIGN.md §4.
//
// A PDF stores positioned fragments, not lines. This rebuilds the report's
// lines, and rebuilds each one as fixed-width columns, because the report
// body is a fixed-width printout. Placing every fragment at the column its
// x position implies, instead of joining fragments with "" or " ", keeps each
// field of a course row in the same column on every row. That's what lets
// stage 5 slice rows by column.
//
// Pure function, no imports: tests build fragment arrays by hand.

// Fragments whose baselines are within this many points share a line.
// Rows are 9pt apart, and STARSRedacter's grade tokens sit 0.16pt below
// their row, so exact grouping orphans every grade (24–58 per report) while
// 2pt orphans none and merges no rows on any of the 12 samples.
export const LINE_TOLERANCE = 2;

// Grades as they print in a course row, including the redaction tokens.
const GRADE_TOKEN = /^(?:Lp|Lf|Pp|Pn|[ABCD][+-]?|F|CR|NC|TR|RG|W|P|NP|IN|IX|UW)$/;

// A divider row as pdf.js hands it over: one fragment of underscores or
// asterisks.
const DIVIDER = /^(?:_{20,}|\*{20,})$/;

const isBlank = (frag) => frag.str.trim() === "";
const perChar = (frag) => frag.width / frag.str.length;

// The document's character width and left margin, measured once across all
// pages. The character width is the most common width-per-character, weighted
// by length: the body is one fixed-width font, and the browser's own header,
// footer and preamble use proportional fonts that each contribute a spread of
// widths. Whitespace fragments are ignored: pdf.js reports their widths
// wrongly (4.82pt for a 3.61pt space).
//
// The margin is where the divider rows (runs of underscores or asterisks)
// start: every report has dozens, all flush with the left edge of the body.
// The leftmost body-font fragment is only a fallback. It can't be the rule,
// because STARSRedacter draws its XXXX over the footer URL at the page edge in
// a matching width, which shifted one sample's whole body 27 columns right.
export function measure(fragments) {
  const weight = new Map();
  for (const frag of fragments) {
    if (isBlank(frag) || !(frag.width > 0)) continue;
    const w = Math.round(perChar(frag) * 100) / 100;
    weight.set(w, (weight.get(w) || 0) + frag.str.length);
  }
  if (weight.size === 0) return null;

  let charWidth = 0;
  let best = -1;
  for (const [w, n] of weight) {
    if (n > best) [charWidth, best] = [w, n];
  }

  let left = Infinity;
  let bodyLeft = Infinity;
  for (const frag of fragments) {
    if (isBlank(frag) || !(frag.width > 0)) continue;
    if (Math.abs(perChar(frag) - charWidth) > charWidth * 0.02) continue;
    bodyLeft = Math.min(bodyLeft, frag.x);
    if (DIVIDER.test(frag.str)) left = Math.min(left, frag.x);
  }
  return { charWidth, left: left === Infinity ? bodyLeft : left };
}

// Groups one page's fragments into lines, top of the page first.
export function groupLines(fragments) {
  const sorted = fragments
    .filter((frag) => !isBlank(frag))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let current = null;
  for (const frag of sorted) {
    if (!current || current.y - frag.y > LINE_TOLERANCE) {
      current = { y: frag.y, fragments: [] };
      lines.push(current);
    }
    current.fragments.push(frag);
  }
  for (const line of lines) line.fragments.sort((a, b) => a.x - b.x);
  return lines.map((line) => line.fragments);
}

// Renders one line's fragments (already ordered left to right) as text, each
// fragment starting at column round((x − left) / charWidth). A fragment that
// would start inside the previous one, which only happens with the
// proportional fonts outside the body, is kept one space after it instead.
export function renderLine(fragments, { charWidth, left }) {
  let out = "";
  for (const frag of fragments) {
    const col = Math.max(0, Math.round((frag.x - left) / charWidth));
    if (col > out.length) out += " ".repeat(col - out.length);
    else if (col < out.length && out !== "") out += " ";
    out += frag.str;
  }
  return out.trimEnd();
}

// The whole document as text, one report line per text line.
export function layout(pages) {
  const metrics = measure(pages.flat());
  if (!metrics) return "";
  const lines = [];
  for (const page of pages) {
    for (const fragments of groupLines(page)) {
      lines.push(renderLine(fragments, metrics));
    }
  }
  return lines.join("\n") + "\n";
}

// The sanity gates from §4, run on every extraction and in tests. Returns a
// list of problems; empty means the layout looks right.
//
//   - A line holding nothing but a grade means a grade was split from its row
//     (the bug the 2pt tolerance fixes).
//   - A line holding two term-led course rows means two rows were merged.
//   - Too few lines for the page count means lines weren't rebuilt at all.
export function layoutProblems(text, pageCount) {
  const problems = [];
  const lines = text.split("\n");

  const orphans = lines.filter((line) => GRADE_TOKEN.test(line.trim()));
  if (orphans.length) {
    problems.push(`${orphans.length} line(s) hold only a grade`);
  }

  const merged = lines.filter(
    (line) => (line.match(/(?:^|\s)\d{5} +\S+ .*?\d+\.\d /g) || []).length > 1
  );
  if (merged.length) {
    problems.push(`${merged.length} line(s) hold two course rows`);
  }

  const nonEmpty = lines.filter((line) => line.trim()).length;
  if (nonEmpty < pageCount * 10) {
    problems.push(`only ${nonEmpty} lines across ${pageCount} page(s)`);
  }
  return problems;
}
