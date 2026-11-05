// The redaction engine the Feedback page runs in the browser. sync:redactor
// copies each file from ../redactor/redactors/ (vendored from STARSRedacter,
// see ../redactor/SOURCE.md) into public/redactor/redactors/ before dev and
// build; the worker fetches them from there. The public copy isn't committed.
export const REDACTOR_FILES = ["__init__.py", "common.py", "engine.py", "grades.py", "pii.py", "residual.py"];
export const REDACTOR_SOURCE_DIR = "../redactor/redactors";
export const REDACTOR_PUBLIC_DIR = "public/redactor/redactors";
