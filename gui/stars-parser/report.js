// The new parser's public entry point in the browser:
// parseStarsReport(file, options) → the parsed report, or null.
//
// Not used by the app yet. index.js keeps exporting the legacy parser until
// milestone M4, when the app switches to this together with the validator
// fixes and the review screen (STARS_PARSER_DESIGN.md §10).
//
// Runs stages 1–2 on the PDF with pdf.js's browser build, then
// parseStarsText for stages 3–6. A failed parse resolves null rather than
// rejecting, the contract both RegCheck and Pathwise already handle, and the
// reason goes to onStatus as a message and to onFailure as a StarsParseError
// whose `check` names what failed, so the review screen can say why.
//
// Everything runs in the browser. Nothing is sent to a server.

import * as pdfjsLib from "pdfjs-dist";

import { extractPages } from "./extract.js";
import { layout, layoutProblems } from "./layout.js";
import { parseStarsText, StarsParseError } from "./parse.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export { StarsParseError };

export async function parseStarsReport(file, { onStatus, onFailure } = {}) {
  const status = (msg) => onStatus && onStatus(msg);
  try {
    status("Reading PDF…");
    const pages = await extractPages(pdfjsLib, new Uint8Array(await file.arrayBuffer()));
    const text = layout(pages);

    if (text.replace(/\s+/g, "").length < 100) {
      throw new StarsParseError(
        "noText",
        "This PDF has no readable text. Print your STARS report to PDF from experience.usc.edu and upload that."
      );
    }
    const problems = layoutProblems(text, pages.length);
    if (problems.length) {
      throw new StarsParseError("layout", `Couldn't lay out this PDF's text (${problems.join("; ")}).`);
    }

    status("Parsing…");
    const result = parseStarsText(text);
    status("Done.");
    return result;
  } catch (err) {
    const failure =
      err instanceof StarsParseError
        ? err
        : new StarsParseError("unreadable", "Couldn't open this PDF. It may be damaged or password-protected.");
    if (!(err instanceof StarsParseError)) console.error("[stars] PDF error:", err);
    status(failure.message);
    if (onFailure) onFailure(failure);
    return null;
  }
}
