// Copies the vendored redaction engine into public/redactor/redactors/ (see
// src/redactorAssets.js). Run from gui/ by predev and prebuild.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REDACTOR_FILES, REDACTOR_SOURCE_DIR, REDACTOR_PUBLIC_DIR } from "../src/redactorAssets.js";

export function syncRedactor(target = REDACTOR_PUBLIC_DIR) {
  mkdirSync(target, { recursive: true });
  return REDACTOR_FILES.map((f) => {
    copyFileSync(join(REDACTOR_SOURCE_DIR, f), join(target, f));
    return join(target, f);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) syncRedactor();
