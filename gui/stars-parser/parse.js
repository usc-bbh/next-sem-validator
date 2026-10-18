// Stages 3–6 on text: parseStarsText(text) → the parsed report.
//
// Takes stage 2's output (what fixtures/stars/<name>.txt holds) and either
// returns the full result (STARS_PARSER_DESIGN.md §8) or throws a
// StarsParseError naming the check that failed. It never returns a partial
// result. No PDF and no browser, so it runs under `node --test`.

import { clean } from "./clean.js";
import { blocks } from "./blocks.js";
import { fields } from "./fields.js";
import { StarsParseError, refuseGraduate, checkStructure, checkResult } from "./checks.js";

export { StarsParseError } from "./checks.js";

export function parseStarsText(text) {
  const body = clean(text);
  if (!body) {
    throw new StarsParseError("notStars", "This doesn't look like a STARS report: there's no PREPARED: line.");
  }
  const bs = blocks(body);
  refuseGraduate(bs);
  checkStructure(bs);
  return checkResult(bs, fields(bs));
}
