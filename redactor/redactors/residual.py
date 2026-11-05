"""Residual personal-information scan (advisory only; never blocks a file).

The redaction passes in `pii.py` and `grades.py` remove the fields STARS
reports are *designed* to carry: name, student ID, mailing address, sport/team,
grades and GPA. They are anchored to the report template, so they do not look
for anything the template does not define.

Occasionally a student's report picks up something else: an email address in a
free-text advising note, a phone number, a date of birth. This module spots
those patterns in the ALREADY-REDACTED text and hands them back so the student
can be asked to take a second look. It is deliberately advisory:

  * It never withholds, alters, or blocks the redacted file.
  * It runs after redaction, so it reports what a reader of the shared file
    would actually see.
  * Patterns are tuned to avoid false alarms on normal STARS content (course
    numbers, unit tallies, term dates), because a warning that cries wolf
    trains students to ignore it.

Anything matched here is shown to the student, never auto-removed: only a human
can tell whether "3.0 units" next to a stray number is a phone number or a
coincidence.
"""
import re

# An email address is distinctive enough that a plain pattern is safe.
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# Phone numbers: require real separators (or parentheses) between the groups.
# A bare 10-digit run is NOT matched on purpose: USC student IDs are 10 digits
# and would otherwise fire on every report. The (?<!\d)/(?!\d) guards stop a
# match from starting or ending in the middle of a longer number.
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[-. ])?(?:\(\d{3}\)[-. ]?|\d{3}[-.])\d{3}[-.]?\d{4}(?!\d)"
)

# Date of birth: only matched when a label says so. An unlabelled date pattern
# is far more likely to be a term date, a clock date, or a print timestamp,
# all of which appear on a normal report.
DOB_RE = re.compile(
    r"(?:D\.?O\.?B\.?|date\s+of\s+birth|birth\s*date|born)\b[^\n]{0,24}?"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{4}-\d{2}-\d{2}"
    r"|[A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4})",
    re.IGNORECASE,
)

# Shown to the student verbatim, so keep the wording plain and non-alarming.
LABELS = {
    "email": "email address",
    "phone": "phone number",
    "dob": "date of birth",
}

_PATTERNS = (("email", EMAIL_RE), ("phone", PHONE_RE), ("dob", DOB_RE))


def scan_text(text):
    """Find advisory patterns in one page's text.

    Returns a list of (kind, matched_value). `kind` is a key of LABELS.
    """
    out = []
    for kind, rx in _PATTERNS:
        for m in rx.finditer(text):
            # DOB_RE captures the date itself in group 1; the others have no
            # group, so fall back to the whole match.
            value = (m.group(1) if rx is DOB_RE else m.group(0)).strip()
            if value:
                out.append((kind, value))
    return out


def scan_doc(doc):
    """Scan every page of a redacted document.

    Returns a list of {"kind", "label", "value", "pages"} dicts, one per
    distinct value, with `pages` a sorted list of 1-based page numbers. Returns
    [] when nothing turns up, which is the normal case.
    """
    seen = {}
    for pno, page in enumerate(doc):
        for kind, value in scan_text(page.get_text("text")):
            key = (kind, value.lower())
            entry = seen.setdefault(
                key, {"kind": kind, "label": LABELS[kind], "value": value,
                      "pages": set()})
            entry["pages"].add(pno + 1)
    return [{**e, "pages": sorted(e["pages"])}
            for e in sorted(seen.values(), key=lambda e: (e["kind"], e["value"]))]
