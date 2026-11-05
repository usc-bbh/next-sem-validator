// Redacts a STARS report on the student's device. A classic worker (Pyodide is
// loaded with importScripts) so the page stays responsive while it runs.
//
// Runs STARSRedacter's engine (vendored in ../redactor/redactors, synced to
// ./redactor/redactors/) on Pyodide 0.28.3, the first release with PyMuPDF.
// The validator stays on its own Pyodide in the page; this one is separate.
//
// in:  { id, bytes: ArrayBuffer }
// out: { id, type: "status", msg } while loading, then
//      { id, type: "done", res, out: ArrayBuffer | null } or { id, type: "error", msg }
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
const FILES = ["__init__.py", "common.py", "engine.py", "grades.py", "pii.py", "residual.py"];
// Same limits as the hosted Redactor (STARSRedacter app.py).
const MAX_PAGES = 15;
const TIME_LIMIT_SECONDS = 30;

let ready = null;

async function load(post) {
  post("Loading the redactor (the first time takes a little while)…");
  importScripts(`${PYODIDE}pyodide.js`);
  const py = await loadPyodide({ indexURL: PYODIDE });
  await py.loadPackage("pymupdf");
  py.FS.mkdirTree("/regcheck/redactors");
  const base = new URL("./redactor/redactors/", self.location.href);
  for (const f of FILES) {
    const resp = await fetch(new URL(f, base));
    if (!resp.ok) throw new Error(`couldn't load ${f}: ${resp.status}`);
    py.FS.writeFile(`/regcheck/redactors/${f}`, await resp.text());
  }
  py.runPython(`
import json, sys
sys.path.insert(0, "/regcheck")
from pyodide.ffi import to_js
from redactors import engine

def regcheck_redact(js_bytes):
    res, out = engine.redact_bytes(bytes(js_bytes.to_py()), {"pii", "grades"},
                                   max_pages=${MAX_PAGES}, time_limit=${TIME_LIMIT_SECONDS})
    return to_js([json.dumps(res, default=list), out])
`);
  return py.globals.get("regcheck_redact");
}

self.onmessage = async ({ data: { id, bytes } }) => {
  const post = (msg) => self.postMessage({ id, type: "status", msg });
  try {
    ready ??= load(post);
    const redact = await ready;
    post("Taking out your name, ID, address and grades…");
    const [resJson, out] = redact(new Uint8Array(bytes));
    const buf = out ? out.slice().buffer : null;
    self.postMessage({ id, type: "done", res: JSON.parse(resJson), out: buf }, buf ? [buf] : []);
  } catch (e) {
    ready = null; // a failed load can be retried
    self.postMessage({ id, type: "error", msg: String(e?.message ?? e) });
  }
};
