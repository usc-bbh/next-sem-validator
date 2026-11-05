"""Core redaction engine, shared by the CLI (`redact_stars.py`) and the
in-browser/hosted app.

`redact_doc` runs the selected passes on an open PyMuPDF document IN PLACE and
returns a status dict; it does NOT save or close (the caller decides where the
bytes go). `redact_bytes` is the in-memory wrapper the hosted app uses so an
uploaded file is never written to the server's disk.

Resource limits (`max_pages`, `time_limit`) are accepted but never *chosen*
here: the engine enforces whatever ceiling it is handed, and the caller decides
the policy. The hosted app sets real limits because it takes files from the
public internet; the CLI leaves them unset because an admin running a local
batch is not a denial-of-service risk. See the guardrail constants at the top
of `app.py`.
"""
import time

import pymupdf

from . import common, pii, grades, residual


def existing_modes(name):
    """What has ALREADY been redacted in a file, inferred from its name."""
    b = str(name).upper()
    # match on the basename only
    b = b.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if b.startswith("REDACTED-PII_"):
        return {"pii"}
    if b.startswith("REDACTED-GRADES_"):
        return {"grades"}
    if b.startswith("REDACTED_"):
        return {"pii", "grades"}
    return set()


def redact_doc(doc, modes, tag=False, existing=frozenset(), deadline=None):
    """Run the selected passes on `doc` in place. Returns a status dict.
    Does NOT save or close the document.

    status is one of: SKIPPED (no text layer), FAILED (no anchors, or a
    survivor was found in verification), REVIEW (clean but a name fragment
    appears elsewhere), REDACTED (clean).

    `deadline` is an optional time.monotonic() stamp; when it passes, a
    common.TimeLimitExceeded is raised from the next checkpoint. Checkpoints sit
    between passes and between pages, so the run stops promptly without leaving
    a half-redacted document in the caller's hands (redact_bytes discards it).

    On success `res["residual"]` carries advisory-only pattern matches found in
    the redacted text (see residual.py). They never change the status: the file
    is returned either way and the student is simply asked to double-check.
    """
    res = {"status": None, "code": None, "reason": "", "pii": {}, "grades": {},
           "fragments": [], "hard": [], "pii_note": "", "residual": []}

    common.check_deadline(deadline)

    if not common.has_text_layer(doc):
        res["status"] = "SKIPPED"
        res["code"] = "NO_TEXT"
        res["reason"] = "no text layer (scanned image; needs OCR-based redaction)"
        return res

    findings, metas = [], {}
    common.check_deadline(deadline)
    if "pii" in modes:
        pf, pm = pii.build_findings(doc, tag=tag)
        if pm["values"]:
            findings += pf
            metas["pii"] = pm
            res["pii"] = pm["values"]
        elif "pii" in existing:
            res["pii_note"] = "already PII-redacted, PII pass skipped"
        else:
            res["status"] = "FAILED"
            res["code"] = "NOT_STARS"
            res["reason"] = "text present but no STARS identifiers detected"
            return res
    common.check_deadline(deadline)
    if "grades" in modes:
        gf, gm = grades.build_findings(doc)
        findings += gf
        metas["grades"] = gm
        res["grades"] = gm

    common.check_deadline(deadline)
    common.apply_and_fill(doc, findings, deadline=deadline)
    common.scrub_metadata(doc)

    common.check_deadline(deadline)
    hard, soft = [], []
    if "pii" in metas:
        h, s = pii.verify(doc, metas["pii"])
        hard += h
        soft += s
    if "grades" in metas:
        h, s = grades.verify(doc, metas["grades"])
        hard += h
        soft += s
    res["fragments"] = soft

    if hard:
        res["status"] = "FAILED"
        res["code"] = "VERIFY_FAILED"
        res["reason"] = "verification failed, output withheld"
        res["hard"] = hard
        return res

    # Advisory only, and deliberately last: it reads the redacted document, so
    # it reports what someone opening the shared file would actually see.
    common.check_deadline(deadline)
    res["residual"] = residual.scan_doc(doc)

    res["status"] = "REVIEW" if soft else "REDACTED"
    res["code"] = "OK"
    return res


def _failed(code, reason, **extra):
    res = {"status": "FAILED", "code": code, "reason": reason, "pii": {},
           "grades": {}, "fragments": [], "hard": [], "pii_note": "",
           "residual": []}
    res.update(extra)
    return res


def redact_bytes(data, modes, tag=False, existing=frozenset(),
                 max_pages=None, time_limit=None):
    """Redact a PDF held in memory. Returns (status_dict, output_bytes_or_None).
    The input bytes are never written to disk; output is produced in memory and
    only returned on REDACTED/REVIEW. Unreadable/corrupt/empty input is reported
    as a FAILED/UNREADABLE status rather than raising.

    Resource limits, both optional and both off by default:
      max_pages   reject a document with more than this many pages, BEFORE any
                  redaction work is done (code TOO_MANY_PAGES; the status dict
                  carries `pages` so the caller can say how long the file was).
      time_limit  seconds of wall-clock budget for the whole run
                  (code TIMEOUT). Enforced cooperatively between pages and
                  passes, so it bounds a pathological file without threads.

    A rejected file produces no output bytes, exactly like any other failure.
    """
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        return _failed("UNREADABLE", "could not open the file as a PDF"), None
    try:
        # Checked first: counting pages is cheap, and it is the difference
        # between refusing a 4,000-page file and starting to redact one.
        pages = doc.page_count
        if max_pages is not None and pages > max_pages:
            return _failed("TOO_MANY_PAGES",
                           f"{pages} pages exceeds the {max_pages}-page limit",
                           pages=pages), None

        deadline = time.monotonic() + time_limit if time_limit else None
        res = redact_doc(doc, modes, tag=tag, existing=existing,
                         deadline=deadline)
        res["pages"] = pages
        out = None
        if res["status"] in ("REDACTED", "REVIEW"):
            out = doc.tobytes(garbage=4, deflate=True, clean=True)
        return res, out
    except common.TimeLimitExceeded:
        return _failed("TIMEOUT",
                       f"redaction exceeded the {time_limit}s time limit"), None
    except Exception:
        return _failed("ERROR", "unexpected error during redaction"), None
    finally:
        doc.close()
