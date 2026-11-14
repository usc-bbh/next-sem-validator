"""Refreshes the D-clearance flags in the Spring 2027 catalogs from USC's live Schedule of Classes.

Departments add and lift D-clearance during registration (English lifted it on most undergrad
courses once registration opened), so the scrape's flags go stale. This changes only
`has_d_clearance`, on each section and on each course (true if any section needs it), and leaves
everything else in the catalog as scraped.

    python3 data/refresh_d_clearance.py            # fetch, then rewrite both catalogs
    python3 data/refresh_d_clearance.py --dry-run  # fetch and report, change nothing
"""
import argparse
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGS = [ROOT / "data" / "spring2027_catalog.json", ROOT / "gui" / "public" / "catalog.json"]
TERM = "20271"
API = "https://classes.usc.edu/api/Courses/Course"


def fetch_flags(course: str, attempts: int = 3) -> dict[str, bool] | None:
    """Section id -> hasDClearance for one course, or None if USC's API didn't answer.
    Retries, since about 2% of requests in a full run time out."""
    url = f"{API}?{urllib.parse.urlencode({'termCode': TERM, 'courseCode': course.replace(' ', '-')})}"
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                live = json.load(resp)
            return {s["sisSectionId"]: bool(s["hasDClearance"]) for s in live.get("sections", [])}
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def apply_flags(catalog: dict, live: dict[str, dict[str, bool] | None]) -> dict:
    """Updates `catalog` in place and returns counts of what changed."""
    counts = {"sections_changed": 0, "courses_changed": 0, "sections_not_live": 0, "courses_unfetched": 0}
    for name, course in catalog.items():
        flags = live.get(name)
        if flags is None:
            counts["courses_unfetched"] += 1
            continue
        sections = [s for group in course.get("sections", {}).values() for s in group]
        for s in sections:
            if s["section_id"] not in flags:
                counts["sections_not_live"] += 1  # left as scraped
                continue
            if s["has_d_clearance"] != flags[s["section_id"]]:
                s["has_d_clearance"] = flags[s["section_id"]]
                counts["sections_changed"] += 1
        any_d = any(s["has_d_clearance"] for s in sections)
        if sections and course.get("has_d_clearance") != any_d:
            course["has_d_clearance"] = any_d
            counts["courses_changed"] += 1
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    names = sorted(json.loads(CATALOGS[0].read_text(encoding="utf-8")))
    with ThreadPoolExecutor(max_workers=8) as pool:
        live = dict(zip(names, pool.map(fetch_flags, names)))
    print(f"fetched {sum(v is not None for v in live.values())} of {len(names)} courses")

    for path in CATALOGS:
        catalog = json.loads(path.read_text(encoding="utf-8"))
        counts = apply_flags(catalog, live)
        print(path.relative_to(ROOT), counts)
        if not args.dry_run:
            path.write_text(json.dumps(catalog), encoding="utf-8")  # the catalogs' own format


if __name__ == "__main__":
    main()
