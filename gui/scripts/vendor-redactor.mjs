// Refreshes ../redactor/redactors/ from a STARSRedacter checkout, the source of
// truth for the redaction engine, and records which commit it came from. Run by
// hand when STARSRedacter's engine changes:
//   node scripts/vendor-redactor.mjs [path/to/STARSRedacter]
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const src = resolve(process.argv[2] ?? "../../STARSRedacter");
const dest = resolve("../redactor/redactors");
const commit = execFileSync("git", ["-C", src, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(join(src, "redactors")).filter((f) => f.endsWith(".py")).sort();
for (const f of files) copyFileSync(join(src, "redactors", f), join(dest, f));

writeFileSync(resolve("../redactor/SOURCE.md"), `# Vendored redaction engine

\`redactors/\` is copied from STARSRedacter (huggingface.co/spaces/buai-builder-hub/STARSRedacter),
commit \`${commit}\`. Don't edit it here: change STARSRedacter, then re-run
\`node scripts/vendor-redactor.mjs\` from \`gui/\`.

The Feedback page runs it in the browser (public/redact-worker.js, Pyodide with
PyMuPDF), so a report is redacted on the student's device and never uploaded.

Files: ${files.join(", ")}
`);
console.log(`vendored ${files.length} files from ${commit.slice(0, 7)}`);
