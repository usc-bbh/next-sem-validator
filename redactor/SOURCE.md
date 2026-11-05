# Vendored redaction engine

`redactors/` is copied from STARSRedacter (huggingface.co/spaces/buai-builder-hub/STARSRedacter),
commit `1b34235a2b17f5e8b75fa0603afe3d295eb45884`. Don't edit it here: change STARSRedacter, then re-run
`node scripts/vendor-redactor.mjs` from `gui/`.

The Feedback page runs it in the browser (public/redact-worker.js, Pyodide with
PyMuPDF), so a report is redacted on the student's device and never uploaded.

Files: __init__.py, common.py, engine.py, grades.py, pii.py, residual.py
