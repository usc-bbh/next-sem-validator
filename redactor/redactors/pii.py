"""PII redaction pass.

Detects the student-identifying fields by their template anchors (constant
labels / formats), never by hard-coded student data. Handles both STARS
layouts: the older "Microsoft Print To PDF" report and the newer
experience.usc.edu ("Skia/PDF") report. Fields include:

  - Student ID            ("ID#:" label, or a 10-digit number in the header)
  - Header name           (after "STARS Report for ", experience.usc.edu)
  - Roster name           ("Last, First, Middle" header line, Microsoft-print)
  - Diploma name          (after "Name as it will appear on your USC Diploma:")
  - Mailing street/zip    (the diploma "mailed to" block, Microsoft-print)
  - Sport / team          (between "Student Athlete:" and "Clock Date:")
  - Report link           (per-report stars.usc.edu token in the print footer)
"""
import re

import pymupdf

CITY_RE = re.compile(r"^[A-Za-z .'\-]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b")
ID_RE = re.compile(r"\b\d{9,10}\b")
ROSTER_RE = re.compile(r"^[A-Z][A-Za-z.'\-]+(?:,\s+[A-Za-z.'\-]+){1,3}$")

TAG_MAP = {
    "Student ID": "ID", "Roster name": "NAME", "Diploma name": "NAME",
    "Header name": "NAME", "Mailing street": "ADDRESS",
    "Mailing city/state/zip": "ADDRESS", "Sport/team": "SPORT",
    "Report link": "LINK",
}


def _first_chunk(s):
    """Text up to the first run of 2+ spaces or a column separator '|'."""
    s = s.split("|", 1)[0]
    return re.split(r"\s{2,}", s.strip(), 1)[0].strip()


def _layout_lines(doc):
    lines = []
    for page in doc:
        txt = page.get_text("text", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
        lines.extend(txt.splitlines())
    return lines


def detect(doc):
    """Return {label: value} of detected identifiers. Missing fields omitted.

    Supports two STARS layouts:
      * "Microsoft Print To PDF":  header has the ID then a "Last, First,
        Middle" line; a diploma section with mailing address; sport line.
      * experience.usc.edu ("Skia/PDF"): name follows "STARS Report for ",
        ID follows "ID#:", plus a per-report link token in the footer; no
        diploma/mailing-address section.
    """
    lines = _layout_lines(doc)
    text = "\n".join(lines)
    found = {}

    # --- Student ID -------------------------------------------------------
    m = re.search(r"ID#:\s*(\d{9,10})", text)           # experience.usc.edu
    if m:
        found["Student ID"] = m.group(1)
    else:
        for ln in lines[:8]:                            # Microsoft-print header
            mm = ID_RE.search(ln)
            if mm:
                found["Student ID"] = mm.group(0)
                break

    # --- Name (experience.usc.edu): "STARS Report for <First Middle Last>" -
    m = re.search(r"STARS Report for\s+(.+)", text)
    if m:
        nm = re.split(r"\s{2,}|\|", m.group(1).strip())[0].strip()
        if nm:
            found["Header name"] = nm

    # --- Roster name (Microsoft-print): "Last, First[, Middle]" in header --
    for ln in lines[:8]:
        cand = _first_chunk(ln)
        if cand and ROSTER_RE.match(cand):
            found["Roster name"] = cand
            break

    # --- Per-report link token (experience.usc.edu print footer) ----------
    m = re.search(r"https?://stars\.usc\.edu/\S+", text)
    if m:
        found["Report link"] = m.group(0)

    for i, ln in enumerate(lines):
        low = ln.lower()
        if "name as it will appear on your usc diploma" in low and "Diploma name" not in found:
            for nxt in lines[i + 1: i + 5]:
                cand = _first_chunk(nxt)
                if cand:
                    found["Diploma name"] = cand
                    break
        if "diploma will be mailed to:" in low and "Mailing street" not in found:
            after = ln.split(":", 1)[1] if ":" in ln else ""
            street = _first_chunk(after)
            if street:
                found["Mailing street"] = street
            for nxt in lines[i + 1: i + 4]:
                cand = _first_chunk(nxt)
                if cand and CITY_RE.match(cand):
                    found["Mailing city/state/zip"] = cand
                    break
        if "student athlete:" in low and "Sport/team" not in found:
            m = re.search(r"student athlete:\s*(.*?)\s*(?:clock date:|$)", ln,
                          re.IGNORECASE)
            if m and m.group(1).strip():
                found["Sport/team"] = m.group(1).strip()
    return found


def _filler(value, tag_label=None):
    if tag_label:
        return f"[REDACTED-{tag_label}]"
    return "X" * len(value)


def build_findings(doc, tag=False):
    """Locate every occurrence of every detected value. Returns
    (findings, meta) where meta = {"values": {...}, "missing": [...]}."""
    values = detect(doc)
    findings, missing = [], []
    for label, value in values.items():
        hits = 0
        for pno, page in enumerate(doc):
            for r in page.search_for(value, quads=False):
                findings.append({"page": pno, "rect": pymupdf.Rect(r),
                                 "box": pymupdf.Rect(r),
                                 "text": _filler(value, TAG_MAP[label] if tag else None)})
                hits += 1
        if hits == 0:
            missing.append((label, value))
    return findings, {"values": values, "missing": missing}


def verify(doc, meta):
    """Return (hard_failures, soft_warnings) checked on the redacted doc.

    HARD: a full identifier survived (text or metadata), or a detected value
    could not be located.  SOFT: a bare name fragment appears elsewhere (may be
    a coincidental course word) -> flagged for human review, not auto-removed.
    """
    values, missing = meta["values"], meta["missing"]
    per_page = [p.get_text("text") for p in doc]
    corpus = "\n".join(per_page).lower()

    hard = []
    for k, v in values.items():
        if v.lower() in corpus:
            hard.append(f"PII {k} {v!r} survived in text")
    md = doc.metadata
    if any(isinstance(val, str) and val
           and any(v.lower() in val.lower() for v in values.values())
           for val in md.values()):
        hard.append("PII survived in document metadata")
    for label, value in missing:
        hard.append(f"{label} {value!r} could not be located on any page")

    soft = []
    tokens = set()
    for label in ("Roster name", "Diploma name", "Header name"):
        if label in values:
            for tok in re.split(r"[,\s]+", values[label]):
                if len(tok) >= 4 and tok.isalpha():
                    tokens.add(tok.lower())
    for tok in sorted(tokens):
        pages = [i + 1 for i, t in enumerate(per_page) if tok in t.lower()]
        if pages:
            soft.append((tok, pages))
    return hard, soft
