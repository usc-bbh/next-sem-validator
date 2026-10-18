import { extractTextFromPDF } from "./legacy/textExtract";
import { parseStarsFields } from "./legacy/fieldParser";

// Main entry point for the STARS parser, as the app uses it today.
//
// This still runs the current parser, kept in legacy/. The rebuilt pipeline
// (parse.js and the stage modules beside it) replaces it at milestone M4,
// together with the validator fixes, so nothing new reaches students before
// then. See STARS_PARSER_DESIGN.md §10.
//
// Supported input: a STARS report printed to PDF from experience.usc.edu,
// which always has a text layer. Returns null if no text can be read, so the
// UI can tell the student.
//
// Everything runs in the browser — no data is sent to a server.
export async function parseStarsReport(file, options = {}) {
  const { onStatus } = options;
  const status = (msg) => onStatus && onStatus(msg);

  const arrayBuffer = await file.arrayBuffer();

  status("Reading PDF...");
  const rawText = await extractTextFromPDF(arrayBuffer);

  if (!rawText || rawText.replace(/\s+/g, "").length < 100) {
    status("Could not extract text from this PDF.");
    return null;
  }

  status("Parsing...");
  const result = parseStarsFields(rawText);
  status("Done.");
  return result;
}

export { parseStarsFields } from "./legacy/fieldParser";
