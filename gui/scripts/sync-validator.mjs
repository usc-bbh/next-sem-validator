// Copies the validator and its data into public/validator/ (see src/validatorAssets.js).
// Run from gui/ by predev and prebuild.
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { VALIDATOR_ASSETS } from "../src/validatorAssets.js";

export function syncValidator(target = "public/validator") {
  mkdirSync(target, { recursive: true });
  return Object.values(VALIDATOR_ASSETS).map(({ from }) => {
    const to = join(target, basename(from));
    copyFileSync(from, to);
    return to;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) syncValidator();
