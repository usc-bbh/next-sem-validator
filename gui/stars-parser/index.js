// The STARS parser's public entry point for the app.
//
// parseStarsReport(file, { onStatus, onFailure }) resolves the parsed report
// (STARS_PARSER_DESIGN.md §8) or null. On null, onFailure has received a
// StarsParseError whose `check` says what failed. Everything runs in the
// browser; no data is sent to a server.
export { parseStarsReport, StarsParseError } from "./report.js";
export { parseStarsText } from "./parse.js";
